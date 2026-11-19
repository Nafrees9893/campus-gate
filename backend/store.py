"""Local persistence, password hashing and campus time."""

import hashlib
import hmac
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAMPUS = timezone(timedelta(hours=5, minutes=30), "Asia/Colombo")


def folder():
    path = Path(os.environ.get("CAMPUS_DATA", ROOT / "data"))
    path.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def db():
    con = sqlite3.connect(folder() / "campus.sqlite3", timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    try:
        with con:
            yield con
    finally:
        con.close()


def init():
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript((ROOT / "backend/schema.sql").read_text())


def now():
    return datetime.now(CAMPUS).isoformat(timespec="seconds")


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(
        password.encode(),
        salt=bytes.fromhex(salt),
        n=32768,
        r=8,
        p=3,
        maxmem=64 * 1024**2,
    )
    return f"scrypt-v1:{salt}:{digest.hex()}"


def matches(password, stored):
    return hmac.compare_digest(password_hash(password, stored.split(":")[1]), stored)


VISIT_QUERY = """
SELECT v.*, p.name AS visitor_name, h.name AS host_name, h.department
FROM visits v JOIN visitors p ON p.id=v.visitor_id JOIN hosts h ON h.id=v.host_id
"""
