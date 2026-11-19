# Campus Gate — University Visitor Management System

Campus Gate gives a university reception desk a visitor directory, staff host directory, live visit register and daily/monthly reports. A returning visitor can check in with an existing profile. Checkout updates the same visit and the dashboard. This is a local classroom prototype with fictional seed data.

## Start the demonstration on Windows

1. Install **Python 3.12** with the Python launcher or the “Add python.exe to PATH” option.
2. Extract the **whole ZIP** to a writable folder. Open the `campus-gate` folder and double-click **Start-Demo-Windows.bat**. The first run downloads the free Python packages and creates a demo SQLite database.
3. Keep the terminal open. When it says the server is running, open **http://127.0.0.1:8000**. Sign in with an account below. To stop the server, press **Ctrl+C** in the terminal.
4. Reopen the same launcher to resume the demo with your saved changes. Once setup is complete, the app, its fonts and icons, and the API documentation run locally without an internet connection.

| Demo role | Email | Password |
|---|---|---|
| Administrator | admin@campus.test | CampusDemo!2026 |
| Reception user | desk@campus.test | CampusDemo!2026 |

The launcher binds to the loopback interface. Use fictional data with these shared demo accounts.

## Start from a terminal

Run the commands from the extracted folder containing `run.py`. SQLite comes with Python. The compiled React UI is included. Only frontend development requires Node.js.

**Windows (PowerShell)**

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py --demo
```

**macOS or Linux**

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py --demo
```

Open **http://127.0.0.1:8000**. Use `--port 8001` if 8000 is busy, then open the corresponding port in the browser. On Linux, a missing venv module may require the distribution's Python venv package. The application and test suite were exercised with Python 3.12.

## Register accounts and use the system

- **Register an administrator.** On the sign-in screen, open the registration form. Enter a name, email, password of 10–128 characters and the administrator code printed in the running server terminal. The launcher creates a new code each run unless the operator sets `CAMPUS_ADMIN_CODE` in the environment.
- **Register a reception user.** Complete the same form with the administrator code empty.
- **Receive a visitor.** Choose an existing profile or add the visitor. Select the staff host and enter the purpose. Check in the visitor. The visit register shows the arrival and open status.
- **Record departure.** Find the active visit in the register and use the checkout action.
- **Export a report.** Open Reports, select daily or monthly, choose the period and download the CSV. Period membership uses the check-in date in Sri Lanka. Counts and checkout status reflect the records at the time you generate the report.

| Permission | Reception user | Administrator |
|---|---|---|
| View dashboard, directories and visits | Yes | Yes |
| Register visitors, check in, check out | Yes | Yes |
| View and download both report types | Yes | Yes |
| Create hosts, edit or delete directory records, correct or delete visits | — | Yes |

A foreign key protects a host or visitor linked to visit history. Use a new unreferenced record to demonstrate directory deletion. The database also enforces one open visit per visitor.

## Clean, empty installation

Run `run.py` **without** `--demo` using the same virtual-environment interpreter. Register the first administrator using the terminal code, add a host, then add a visitor. This mode uses `data/local/`. Demo mode uses `data/demo/`. Both create the database on first use. To rehearse from scratch without deleting existing work, extract the ZIP into a second folder and launch there.

Each data directory contains `campus.sqlite3` and rotating `actions.log` files. The log records actor ID (when available), HTTP method, path and outcome, plus unexpected exceptions. Passwords, cookies and submitted forms are excluded from normal request logs. Stop the server before copying its data directory as a backup. Keep these runtime files out of Git.

## Project map

| Location | Contents |
|---|---|
| `frontend/src/`, `frontend/build.mjs` | React SPA source and build script |
| `frontend/dist/` | Ready-to-run web interface with local assets |
| `backend/app.py` | REST routes, session checks, authorization, reports and request logging |
| `backend/models.py`, `backend/store.py` | Input/output models, database access and password hashing |
| `backend/schema.sql` | SQLite tables, foreign keys, uniqueness rules and indexes |
| `backend/openapi.json` | Downloadable OpenAPI specification |
| `backend/demo.py` | Idempotent fictional demo seed |
| `tests/test_workflows.py` | HTTP integration tests using a temporary database |
| `docs/Project-and-Demo-Guide.md` | Requirements, relational design, acceptance checks, seven-minute team demonstration and Q&A |
| `docs/Campus-Gate-Presentation.pptx` | Editable eight-slide final presentation with speaker notes |
| `history.bundle` | Portable Git history, included in the distribution ZIP |

## API and tests

While the app is running, open **http://127.0.0.1:8000/docs** for interactive Swagger or **http://127.0.0.1:8000/openapi.json** for the specification. Sign in to the app in the same browser and use Swagger's **Try it out** controls. Both use the same HTTP-only session cookie. The snapshot in `backend/openapi.json` can be inspected offline.

From the project folder, run the integration suite with the virtual-environment interpreter:

```sh
python -m unittest discover -s tests -v
```

Use `.venv/bin/python` on macOS/Linux or `.\.venv\Scripts\python.exe` on Windows if the environment is not activated. Tests start a temporary local server and database. They exercise registration, admin invitations, login/logout, role restrictions, CRUD, concurrent duplicate check-in, checkout, linked-record protection, report cutoffs, CSV escaping, validation and action logging.

## Implementation choices

- The React SPA and FastAPI backend share one origin. SQLite stores records between restarts. Mutations run in transactions. All user values reach SQL as bound parameters.
- Passwords use scrypt with a separate random salt per password. The server stores only a SHA-256 digest of each random session token. Sessions expire after eight hours and logout invalidates the token. Local HTTP cookies use HttpOnly and SameSite=Strict. The application sets the Secure flag when served over HTTPS.
- Timestamps use campus time (UTC+05:30). Reports count arrivals in the selected period and include their latest checkout. Report names and departments come from the current directory entries.
- This version is intended for one local reception desk. Its scope excludes advance scheduling, identity-document collection and host notifications.

## Rebuild the frontend or continue in Git

To change the interface, install Node.js 22 or later, then run the following from the project folder. Restart the Python server and refresh the page after rebuilding.

```sh
cd frontend
npm ci
npm run build
```

The ZIP contains the current source and a Git bundle containing the project commits. To work from that history, run from the extracted project folder:

```sh
git clone -b main history.bundle ../campus-gate-dev
cd ../campus-gate-dev
git log --oneline
```

The Git bundle is a distribution artifact. Runtime databases, logs, virtual environments and node_modules are excluded. Swagger UI 5.32.1 license notices are included under `backend/swagger/`. Frontend dependencies and bundled license notices are under `frontend/`.
