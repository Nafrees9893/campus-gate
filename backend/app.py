"""REST API for the campus reception desk."""

import csv
import hashlib
import hmac
import io
import logging
import os
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import date, timedelta
from logging.handlers import RotatingFileHandler
from threading import Lock
from typing import Literal
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyCookie
from fastapi.staticfiles import StaticFiles
from .models import (
    ErrorMessage,
    Host,
    HostOut,
    Login,
    Register,
    Report,
    UserOut,
    Visit,
    VisitOut,
    Visitor,
    VisitorOut,
)
from .store import ROOT, VISIT_QUERY, db, folder, init, matches, now, password_hash

log = logging.getLogger("campus")


@asynccontextmanager
async def lifespan(app):
    init()
    handler = RotatingFileHandler(
        folder() / "actions.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.setLevel(logging.INFO)
    log.addHandler(handler)
    try:
        yield
    finally:
        log.removeHandler(handler)
        handler.close()


app = FastAPI(
    title="Campus Gate | Reception API",
    version="1.0.0",
    lifespan=lifespan,
    responses={
        401: {"model": ErrorMessage, "description": "Session or credentials invalid"},
        403: {"model": ErrorMessage, "description": "Access denied"},
        404: {"model": ErrorMessage, "description": "Record not found"},
        409: {
            "model": ErrorMessage,
            "description": "Record conflicts with a database rule",
        },
        422: {"model": ErrorMessage, "description": "Invalid input"},
    },
    docs_url=None,
    redoc_url=None,
    description="Sign in using the session endpoints. Reception users register visitors, check them in and out, and run reports. Admins also maintain directories and correct records.",
)
app.mount(
    "/api-doc-assets",
    StaticFiles(directory=ROOT / "backend/swagger"),
    name="Swagger assets",
)


@app.get("/docs", include_in_schema=False)
def swagger():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Campus Gate API",
        swagger_js_url="/api-doc-assets/swagger-ui-bundle.js",
        swagger_css_url="/api-doc-assets/swagger-ui.css",
        swagger_favicon_url="/api-doc-assets/favicon-32x32.png",
        swagger_ui_parameters={"validatorUrl": None},
    )


cookie = APIKeyCookie(name="campus_session", auto_error=False)


@app.middleware("http")
async def action_log(request, call_next):
    path = request.url.path
    if (
        request.method not in ("GET", "HEAD", "OPTIONS")
        and request.headers.get("origin")
        and urlsplit(request.headers["origin"]).netloc != request.headers.get("host")
    ):
        log.warning("rejected_cross_origin method=%s", request.method)
        return JSONResponse(
            {"detail": "Request origin is not allowed"}, status_code=403
        )
    try:
        response = await call_next(request)
    except Exception:
        log.exception("request_failed method=%s path=%r", request.method, path)
        return JSONResponse(
            {"detail": "Unexpected server error. See the local action log."},
            status_code=500,
        )
    if path.startswith("/api/"):
        log.log(
            logging.WARNING if response.status_code >= 400 else logging.INFO,
            "actor=%s method=%s path=%r status=%d",
            getattr(request.state, "actor", "guest"),
            request.method,
            path,
            response.status_code,
        )
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(RequestValidationError)
async def validation(request, exc):
    errors = [f"{e['loc'][-1]}: {e['msg']}" for e in exc.errors()]
    return JSONResponse({"detail": "; ".join(errors)}, status_code=422)


@app.exception_handler(sqlite3.IntegrityError)
async def conflict(request, exc):
    msg = str(exc)
    if "FOREIGN KEY" in msg:
        detail = "A linked record is missing or still has visit history."
    elif "visits.visitor_id" in msg:
        detail = "This visitor already has an open visit."
    elif "email" in msg:
        detail = "This email address is already registered."
    else:
        detail = "This change conflicts with an existing record."
    return JSONResponse({"detail": detail}, status_code=409)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def user(request: Request, token: str | None = Depends(cookie)):
    with db() as con:
        row = con.execute(
            "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE token_hash=? AND expires_at>?",
            (digest(token or ""), int(time.time())),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Please sign in.")
    request.state.actor = row["id"]
    return dict(row)


def admin(current=Depends(user)):
    if current["role"] != "admin":
        raise HTTPException(403, "Administrator access required.")
    return current


def session(con, uid, response, request):
    secret = secrets.token_urlsafe(32)
    con.execute("DELETE FROM sessions WHERE expires_at<=?", (int(time.time()),))
    con.execute(
        "INSERT INTO sessions VALUES (?,?,?)",
        (digest(secret), uid, int(time.time()) + 28800),
    )
    response.set_cookie(
        "campus_session",
        secret,
        max_age=28800,
        httponly=True,
        samesite="strict",
        secure=request.url.scheme == "https",
        path="/",
    )
    request.state.actor = uid
    return dict(
        con.execute(
            "SELECT id,name,email,role FROM users WHERE id=?", (uid,)
        ).fetchone()
    )


attempts = {}
attempt_lock = Lock()


def auth_limit(request: Request):
    address = request.client.host if request.client else "local"
    minute = int(time.monotonic() // 60)
    with attempt_lock:
        stamp, count = attempts.get(address, (minute, 0))
        count = count + 1 if stamp == minute else 1
        attempts[address] = (minute, count)
    if count > 25:
        raise HTTPException(429, "Too many attempts. Try again in one minute.")


@app.post(
    "/api/auth/register",
    response_model=UserOut,
    status_code=201,
    tags=["Session"],
    dependencies=[Depends(auth_limit)],
)
def register(data: Register, response: Response, request: Request):
    code = os.environ.get("CAMPUS_ADMIN_CODE", "")
    if data.admin_code and (
        not code or not hmac.compare_digest(data.admin_code.encode(), code.encode())
    ):
        raise HTTPException(403, "The administrator invitation code is incorrect.")
    with db() as con:
        uid = con.execute(
            "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
            (
                data.name,
                data.email,
                password_hash(data.password),
                "admin" if data.admin_code else "user",
            ),
        ).lastrowid
        return session(con, uid, response, request)


@app.post(
    "/api/auth/login",
    response_model=UserOut,
    tags=["Session"],
    dependencies=[Depends(auth_limit)],
)
def login(data: Login, response: Response, request: Request):
    with db() as con:
        row = con.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
        if not row or not matches(data.password, row["password_hash"]):
            raise HTTPException(401, "Email or password is incorrect.")
        return session(con, row["id"], response, request)


@app.post("/api/auth/logout", status_code=204, tags=["Session"])
def logout(response: Response, token=Depends(cookie), current=Depends(user)):
    with db() as con:
        con.execute("DELETE FROM sessions WHERE token_hash=?", (digest(token),))
    response.delete_cookie("campus_session", path="/")


@app.get("/api/auth/me", response_model=UserOut, tags=["Session"])
def me(current=Depends(user)):
    return current


def require(row):
    if row is None:
        raise HTTPException(404, "Record not found.")
    return dict(row)


def directory_routes(table, model, output, create_role):
    # Table, columns and annotations come exclusively from this module.
    path = "/api/" + table
    columns = list(model.model_fields)

    def lookup(con, key):
        return require(
            con.execute(f"SELECT * FROM {table} WHERE id=?", (key,)).fetchone()
        )

    @app.get(path, response_model=list[output], tags=[table], name=f"List {table}")
    def listing(current=Depends(user)):
        with db() as con:
            return [
                dict(r)
                for r in con.execute(
                    f"SELECT * FROM {table} ORDER BY name COLLATE NOCASE,id"
                )
            ]

    @app.get(
        path + "/{key}",
        response_model=output,
        tags=[table],
        name=f"Read {table} record",
    )
    def read(key: int, current=Depends(user)):
        with db() as con:
            return lookup(con, key)

    @app.post(
        path,
        status_code=201,
        response_model=output,
        tags=[table],
        name=f"Create {table} record",
    )
    def create(data: model, current=Depends(create_role)):
        with db() as con:
            key = con.execute(
                f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})",
                tuple(data.model_dump().values()),
            ).lastrowid
            return lookup(con, key)

    @app.put(
        path + "/{key}",
        response_model=output,
        tags=[table],
        name=f"Update {table} record",
    )
    def edit(key: int, data: model, current=Depends(admin)):
        with db() as con:
            con.execute(
                f"UPDATE {table} SET {','.join(c+'=?' for c in columns)} WHERE id=?",
                (*data.model_dump().values(), key),
            )
            return lookup(con, key)

    @app.delete(
        path + "/{key}", status_code=204, tags=[table], name=f"Delete {table} record"
    )
    def remove(key: int, current=Depends(admin)):
        with db() as con:
            if not con.execute(f"DELETE FROM {table} WHERE id=?", (key,)).rowcount:
                raise HTTPException(404, "Record not found.")


directory_routes("visitors", Visitor, VisitorOut, user)
directory_routes("hosts", Host, HostOut, admin)


def visit(con, key):
    return require(con.execute(VISIT_QUERY + " WHERE v.id=?", (key,)).fetchone())


@app.get("/api/visits", response_model=list[VisitOut], tags=["Visits"])
def visits(current=Depends(user)):
    with db() as con:
        return [
            dict(r)
            for r in con.execute(VISIT_QUERY + " ORDER BY v.check_in DESC,v.id DESC")
        ]


@app.get("/api/visits/{key}", response_model=VisitOut, tags=["Visits"])
def read_visit(key: int, current=Depends(user)):
    with db() as con:
        return visit(con, key)


@app.post("/api/visits", response_model=VisitOut, status_code=201, tags=["Visits"])
def check_in(data: Visit, current=Depends(user)):
    with db() as con:
        key = con.execute(
            "INSERT INTO visits(visitor_id,host_id,purpose,check_in) VALUES(?,?,?,?)",
            (data.visitor_id, data.host_id, data.purpose, now()),
        ).lastrowid
        return visit(con, key)


@app.put("/api/visits/{key}", response_model=VisitOut, tags=["Visits"])
def edit_visit(key: int, data: Visit, current=Depends(admin)):
    with db() as con:
        con.execute(
            "UPDATE visits SET visitor_id=?,host_id=?,purpose=? WHERE id=?",
            (data.visitor_id, data.host_id, data.purpose, key),
        )
        return visit(con, key)


@app.post("/api/visits/{key}/checkout", response_model=VisitOut, tags=["Visits"])
def check_out(key: int, current=Depends(user)):
    with db() as con:
        changed = con.execute(
            "UPDATE visits SET check_out=? WHERE id=? AND check_out IS NULL",
            (now(), key),
        ).rowcount
        record = visit(con, key)
        if not changed:
            raise HTTPException(409, "This visit has already ended.")
        return record


@app.delete("/api/visits/{key}", status_code=204, tags=["Visits"])
def delete_visit(key: int, current=Depends(admin)):
    with db() as con:
        if not con.execute("DELETE FROM visits WHERE id=?", (key,)).rowcount:
            raise HTTPException(404, "Record not found.")


def cell(value):
    text = "" if value is None else str(value)
    return (
        "'" + text
        if text.lstrip().startswith(("=", "+", "-", "@"))
        or text.startswith(("\r", "\n", "\t"))
        else text
    )


@app.get(
    "/api/reports/{kind}",
    response_model=Report,
    tags=["Reports"],
    responses={200: {"content": {"text/csv": {}}}},
    summary="Report of arrivals for a campus day or month",
)
def report(
    kind: Literal["daily", "monthly"],
    period: str,
    format: Literal["json", "csv"] = "json",
    current=Depends(user),
):
    try:
        start = date.fromisoformat(period + "-01" if kind == "monthly" else period)
        if period != (
            start.isoformat()[:7] if kind == "monthly" else start.isoformat()
        ):
            raise ValueError()
        end = (
            (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            if kind == "monthly"
            else start + timedelta(days=1)
        )
    except (ValueError, OverflowError):
        raise HTTPException(422, "Choose a valid day (YYYY-MM-DD) or month (YYYY-MM).")
    with db() as con:
        rows = [
            dict(r)
            for r in con.execute(
                VISIT_QUERY
                + " WHERE v.check_in>=? AND v.check_in<? ORDER BY v.check_in DESC,v.id DESC",
                (start.isoformat(), end.isoformat()),
            )
        ]
    if format == "csv":
        stream = io.StringIO(newline="")
        writer = csv.writer(stream)
        writer.writerow(
            [
                "Visit ID",
                "Visitor",
                "Host",
                "Department",
                "Purpose",
                "Check-in (Colombo)",
                "Checkout (Colombo)",
                "Current status",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    cell(row[k])
                    for k in (
                        "id",
                        "visitor_name",
                        "host_name",
                        "department",
                        "purpose",
                        "check_in",
                        "check_out",
                    )
                ]
                + ["Checked out" if row["check_out"] else "On campus"]
            )
        return Response(
            "\ufeff" + stream.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="campus-{kind}-{period}.csv"'
            },
        )
    closed = sum(r["check_out"] is not None for r in rows)
    return {
        "total": len(rows),
        "on_campus": len(rows) - closed,
        "checked_out": closed,
        "rows": rows,
    }


if (ROOT / "frontend/dist").is_dir():
    app.mount(
        "/", StaticFiles(directory=ROOT / "frontend/dist", html=True), name="Reception"
    )
