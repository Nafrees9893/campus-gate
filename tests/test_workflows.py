"""Exercise the actual HTTP API against a temporary SQLite database."""

import concurrent.futures
import csv
import http.cookiejar
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
from backend.store import db, init
from backend.demo import seed

ROOT = Path(__file__).resolve().parents[1]


class Client:
    def __init__(self, base):
        self.base = base
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    def call(self, method, path, body=None, expected=200, headers=None):
        request = urllib.request.Request(
            self.base + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **(headers or {})},
            method=method,
        )
        try:
            response = self.opener.open(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read().decode("utf-8-sig")
            if response.status != expected:
                raise AssertionError(
                    f"{method} {path} returned {response.status}, expected {expected}: {raw}"
                )
            return (
                json.loads(raw)
                if raw and "json" in response.headers.get("Content-Type", "")
                else raw
            )


class Workflows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.tmp.cleanup)
        cls.env = {
            "CAMPUS_DATA": cls.tmp.name,
            "CAMPUS_ADMIN_CODE": "local-demo-invitation",
        }
        with patch.dict(os.environ, cls.env):
            init()
            seed()
            seed()
            with db() as con:
                assert con.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 2
                assert (
                    con.execute("SELECT password_hash FROM users LIMIT 1")
                    .fetchone()[0]
                    .startswith("scrypt-v1:")
                )
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        cls.server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.app:app", "--port", str(port)],
            cwd=ROOT,
            env={**os.environ, **cls.env},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        def stop():
            cls.server.terminate()
            cls.server.wait(timeout=10)

        cls.addClassCleanup(stop)
        for _ in range(100):
            try:
                Client(cls.base).call("GET", "/openapi.json")
                break
            except OSError:
                time.sleep(0.05)
        cls.admin = Client(cls.base)
        cls.desk = Client(cls.base)
        for client, email in [(cls.admin, "admin"), (cls.desk, "desk")]:
            client.call(
                "POST",
                "/api/auth/login",
                {"email": email + "@campus.test", "password": "CampusDemo!2026"},
            )

    def test_roles_and_registration(self):
        guest = Client(self.base)
        guest.call("GET", "/api/visits", expected=401)
        fields = {
            "name": "Test User",
            "password": "test-password-123",
            "email": "new@example.test",
        }
        guest.call("POST", "/api/auth/register", {**fields, "admin_code": "wrong"}, 403)
        self.assertEqual(
            guest.call("POST", "/api/auth/register", fields, 201)["role"], "user"
        )
        guest.call("POST", "/api/auth/logout", expected=204)
        guest.call("GET", "/api/auth/me", expected=401)
        guest.call(
            "POST",
            "/api/auth/login",
            {**{"email": fields["email"]}, "password": "wrong"},
            401,
        )
        guest.call("POST", "/api/auth/register", fields, 409)
        account = guest.call(
            "POST",
            "/api/auth/register",
            {
                **fields,
                "email": "invited@example.test",
                "admin_code": self.env["CAMPUS_ADMIN_CODE"],
            },
            201,
        )
        self.assertEqual(account["role"], "admin")
        guest.call(
            "POST",
            "/api/auth/logout",
            expected=403,
            headers={"Origin": "http://other.invalid"},
        )
        self.assertEqual(guest.call("GET", "/api/auth/me")["id"], account["id"])

    def test_directory_and_visit_lifecycle(self):
        host = {
            "name": "Test Host",
            "email": "host@example.test",
            "department": "Sciences",
        }
        self.desk.call("POST", "/api/hosts", host, 403)
        hid = self.admin.call("POST", "/api/hosts", host, 201)["id"]
        hp = f"/api/hosts/{hid}"
        self.admin.call("PUT", hp, {**host, "department": "Technology"})
        self.assertEqual(self.desk.call("GET", hp)["department"], "Technology")
        self.desk.call("POST", "/api/visitors", {"name": " "}, 422)
        person = {"name": "Test Visitor", "phone": "+94 77 000 0000"}
        pid = self.desk.call("POST", "/api/visitors", person, 201)["id"]
        pp = f"/api/visitors/{pid}"
        self.desk.call("PUT", pp, person, 403)
        self.admin.call("PUT", pp, {**person, "organization": "Campus Club"})
        self.assertEqual(self.desk.call("GET", pp)["organization"], "Campus Club")
        fields = {"visitor_id": pid, "host_id": hid, "purpose": "Research meeting"}
        self.desk.call("POST", "/api/visits", {**fields, "host_id": 9999999}, 409)

        def concurrent_checkin(_):
            try:
                return self.desk.call("POST", "/api/visits", fields, 201)["id"]
            except AssertionError as exc:
                self.assertIn("returned 409", str(exc))
                return None

        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            created = [x for x in pool.map(concurrent_checkin, range(2)) if x]
        self.assertEqual(len(created), 1)
        vp = f"/api/visits/{created[0]}"
        self.admin.call("DELETE", hp, expected=409)
        self.admin.call("DELETE", pp, expected=409)
        self.admin.call("PUT", vp, {**fields, "purpose": "Alumni visit"})
        self.assertEqual(self.desk.call("GET", vp)["purpose"], "Alumni visit")
        self.desk.call("POST", vp + "/checkout")
        self.desk.call("POST", vp + "/checkout", expected=409)
        self.desk.call("DELETE", vp, expected=403)
        self.admin.call("DELETE", vp, expected=204)
        self.admin.call("DELETE", pp, expected=204)
        self.admin.call("DELETE", hp, expected=204)
        self.admin.call("GET", vp, expected=404)
        self.assertIn("status=409", (Path(self.tmp.name) / "actions.log").read_text())

    def test_reporting_boundaries_and_export(self):
        with patch.dict(os.environ, self.env), db() as con:
            con.execute(
                "INSERT INTO visits(visitor_id,host_id,purpose,check_in,check_out) VALUES (1,1,?,?,?)",
                ("=DEMO", "2024-02-29T23:59:59+05:30", "2024-03-01T00:04:12+05:30"),
            )
        for period, kind in [("2024-02-29", "daily"), ("2024-02", "monthly")]:
            path = f"/api/reports/{kind}?period={period}"
            report = self.desk.call("GET", path)
            self.assertEqual(
                (report["total"], report["checked_out"], report["on_campus"]), (1, 1, 0)
            )
            exported = list(
                csv.reader(io.StringIO(self.desk.call("GET", path + "&format=csv")))
            )
            self.assertEqual(exported[1][4], "'=DEMO")
        self.assertEqual(
            self.desk.call("GET", "/api/reports/monthly?period=2024-03")["total"], 0
        )
        self.desk.call("GET", "/api/reports/daily?period=2023-02-29", expected=422)

    def test_schema_and_sql_inputs(self):
        api = Client(self.base).call("GET", "/openapi.json")
        self.assertIn("/api/visits/{key}/checkout", api["paths"])
        row = self.desk.call(
            "POST",
            "/api/visitors",
            {"name": "O'Brien", "organization": "St. Mary's"},
            201,
        )
        self.assertEqual(
            self.desk.call("GET", f"/api/visitors/{row['id']}")["name"], "O'Brien"
        )
        self.admin.call("DELETE", f"/api/visitors/{row['id']}", expected=204)


if __name__ == "__main__":
    unittest.main()
