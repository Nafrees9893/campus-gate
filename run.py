"""Start Campus Gate on this computer. python run.py --demo"""

import argparse
import os
import secrets
import uvicorn
from backend.store import ROOT, init

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--demo",
        action="store_true",
        help="use a separate database with fictional reception data and two demo accounts",
    )
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    os.environ.setdefault(
        "CAMPUS_DATA", str(ROOT / "data" / ("demo" if args.demo else "local"))
    )
    os.environ.setdefault("CAMPUS_ADMIN_CODE", secrets.token_urlsafe(12))
    init()
    if args.demo:
        from backend.demo import seed

        seed()
    print(
        f"\nCampus Gate: http://127.0.0.1:{args.port}\nAdmin registration code for this run: {os.environ['CAMPUS_ADMIN_CODE']}",
        flush=True,
    )
    uvicorn.run("backend.app:app", host="127.0.0.1", port=args.port)
