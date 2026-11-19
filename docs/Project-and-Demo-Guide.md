# Campus Gate
## Project design and demonstration guide

A university reception desk records guests when they arrive to meet a staff host. A returning guest can reuse the same visitor record. At departure, reception closes the visit. An administrator maintains the directories and can correct entries. Both roles can download visit reports.

### Requirements and scope

The coursework brief supplies the acceptance criteria. The desktop and mobile wireframes identify the dashboard, visitor list, host directory, visit register, reports and sign-in screen. These are the design inputs for this prototype. The following requirements translate those inputs into actions that a team can demonstrate.

| Actor | Need | Observable acceptance condition |
|---|---|---|
| Reception user | Find a returning visitor or add a first-time guest | The visitor appears in the directory and can be selected for a visit. |
| Reception user | Record an arrival and a departure | The register shows an open visit after check-in and a departure time after checkout. |
| Administrator | Maintain host, visitor and visit records | Create, read, update and delete an eligible record through the application. |
| Either role | Review visits for a campus day or month | Select the period, inspect its rows, download CSV and open the result in a spreadsheet. |
| Maintainer | Diagnose failures and reproduce the demo | Start the application following the README, inspect the API description, run the tests and review the logs. |

The live workflow covers visitors who have arrived. A visit begins at check-in. Future appointments, identity verification, visitor badges and host notifications are outside this semester prototype.

### Data analysis and relational design

A visitor is a guest. A host is a university staff contact. A user is a person authorized to operate the application. These identities are independent. Each visit links to one visitor and one host, and each directory entry can appear in many visits. Keeping reusable records in separate tables allows returning guests to keep a single directory identity.

| Table | Key and relationships | Data and business rules |
|---|---|---|
| `users` | Primary key `id` | Name, case-insensitively unique email, password hash and a role of `admin` or `user`. |
| `sessions` | Primary key `token_hash`, foreign key `user_id` | Stores the session token digest and expiry. Each session belongs to one account. |
| `visitors` | Primary key `id` | Name, email, phone and organization. Different people may share a name. |
| `hosts` | Primary key `id` | Name, case-insensitively unique email and department. |
| `visits` | Primary key `id`, foreign keys `visitor_id` and `host_id` | Purpose, check-in and optional checkout. The database checks that checkout is at or after arrival. |

~~~mermaid
erDiagram
    USERS ||--o{ SESSIONS : owns
    VISITORS ||--o{ VISITS : makes
    HOSTS ||--o{ VISITS : receives
~~~

The SQL definition is in [backend/schema.sql](../backend/schema.sql). A partial unique index on `visitor_id` applies while checkout is empty. Even if two requests try to check in the same person at the same time, only one open visit can exist. Foreign keys restrict deletion of a visitor or host referenced by a visit. An administrator can delete an unreferenced directory entry, such as a duplicate created in error.

### Architecture and implementation

The React single-page application loads in the browser. Registration, login, data changes and report requests go through the Python REST API. The backend checks the session and role, validates fields and writes to SQLite through parameterized queries. SQLite persists the records in a local database file. A browser refresh therefore reads the saved state from the server.

| Example workflow | REST operation | Result |
|---|---|---|
| Review directory | `GET /api/visitors` | The SPA receives visitor records as JSON. |
| Register a guest | `POST /api/visitors` | A visitor gets a stable ID for future visits. |
| Record arrival | `POST /api/visits` | The request selects a visitor and host and records a purpose. |
| Record departure | `POST /api/visits/{id}/checkout` | The same visit gains a checkout time. |
| Correct or remove a visit | `PUT` or `DELETE /api/visits/{id}` | The API checks administrator access before applying the change. |
| Export daily report | `GET /api/reports/daily?period=2026-11-18&format=csv` | Returns CSV for the selected day. |
| Export monthly report | `GET /api/reports/monthly?period=2026-11&format=csv` | Returns CSV for the selected month. |

The project README gives local setup, startup and test commands. The API's OpenAPI specification describes the complete routes and payloads. Client-side form checks give immediate feedback. The server validates the request independently.

### Reporting rules

A report counts visits by the check-in date in campus time, Asia/Colombo. Two separate visits by the same person count as two rows. Status reflects the latest stored checkout time when the report runs. For example, an arrival at 23:50 on 31 October and departure at 00:15 on 1 November appears in the October report. A historical report can therefore show a checkout that was recorded after its reporting period. Period counts describe the arrivals in that period. Campus-wide current occupancy is a distinct question and also includes people who arrived earlier.

### Seven-minute live demonstration

Use fictional contact details and a different suffix, such as 01 or 02, each time you rehearse. First launch the app using the README. Have an administrator account ready, and set up an ordinary reception account. Share the presentation across three speakers according to the proposed timings.

| Time | Speaker | Action | What the assessor should see |
|---|---|---|---|
| 0:00–1:00 | 1 | Introduce the desk scenario. Use the wireframe slide to explain why visitor details are separate from visit records. | A clear requirement and the original design input. |
| 1:00–2:00 | 1 | Sign in as administrator. Add host “Demo Lecturer 01”, email `lecturer01@example.test`, department “Technology”. Edit the department to “Agricultural Technology”. | The updated contact appears in Hosts. |
| 2:00–3:30 | 2 | Sign in as reception. Add “Demo Guest 01”, organization “Campus Project”, email `guest01@example.test` and phone `0771234567`. Check this visitor in with Demo Lecturer 01 for “Project discussion”. | Both the directory record and an open visit are visible. |
| 3:30–4:30 | 2 | Refresh the page, find the open visit, then record checkout. | The record persists. The same visit now shows a departure time. |
| 4:30–5:30 | 3 | Select today's daily report and download CSV. Repeat for the current month. Open a CSV and locate Demo Guest 01. | Both reports include the visit. Record counts agree with the corresponding rows. |
| 5:30–6:30 | 3 | Show the OpenAPI description, the database schema and the log for a recent action. Explain the role and database checks. | The browser interaction is traceable through the backend and database. |
| 6:30–7:00 | 3 | Sign back in as admin. Create a disposable, unreferenced host and delete it. Leave the main demonstration visit available for questions. | The administrator can complete the delete step without disturbing the demo history. |

### Acceptance checks for rehearsal

These checks state expected behavior. Run them against a demonstration database. Use the automated test instructions in the README for repeatable regression checks.

| Check | Steps | Expected behavior |
|---|---|---|
| Registration and login | Register an ordinary account, sign out and sign back in. Register an admin with the setup code. | Both accounts can sign in. Host maintenance requires the admin role. |
| Password storage | Inspect the `password_hash` field of a disposable account locally. | The stored value is a salted hash. |
| Input validation | Leave a required field empty. Correct it and submit again. | The first attempt fails. The corrected record saves once. |
| Duplicate open visit | While a guest is on campus, attempt to check the same guest in again. | A second open visit cannot be recorded. After checkout, a new visit is allowed. |
| Protected relationships | As admin, attempt to delete a host linked to a visit. Then delete a disposable host without visits. | The referenced host is protected. The unreferenced host can be deleted. |
| Role checks | As a reception user, attempt host maintenance. Repeat a permitted check-in. | Host maintenance is restricted. Check-in succeeds. |
| Reports | Use a period containing the sample visit, then a period with no arrivals. | Rows match the chosen period. The empty period has zero arrivals. |
| Persistence | Shut down the server normally and restart it using the same data directory. | The saved visitor and visit are still present. |

### Likely questions and answers

**Why choose SQLite?** A local file satisfies the relational database requirement and supports foreign keys, transactions and indexes. A student can run the demonstration without installing a separate database service.

**What happens if reception presses check-in twice?** The partial unique index allows only one visit with a missing checkout for each visitor. Closing that visit releases the visitor for a later check-in.

**How does the application know which visitors are on campus?** A visit with no checkout is open. This is an administrative record of the last action reception recorded. A missed checkout leaves the visit open.

**How does the system protect passwords and enforce roles?** It uses salted scrypt password hashes and server-side sessions. The backend reads the account role before allowing protected actions, including edits, deletions and host management.

**Why can a visitor with history be difficult to delete?** Visits refer to the visitor ID. SQLite prevents deleting that directory record while any visit refers to it. This keeps report rows linked to a valid guest.

**What trade-off does this schema make?** Visits refer to current visitor and host records. Editing a person's display name or a host's department can change what an old report shows. An institution needing an immutable historical roster could store a snapshot or version each directory record.

**How would a production rollout differ?** A campus deployment would need institution-managed accounts, HTTPS, operational backups, retention rules for visitor data and a process for missed checkouts. These are future deployment decisions.

**How should we divide the presentation?** The timings assign requirement gathering and directory maintenance to speaker 1, data design and the live visit to speaker 2, and reporting, testing and Q&A to speaker 3. Record the team's actual implementation contributions separately.

### Verification performed on the delivered prototype

| Check | Observed result |
|---|---|
| Fresh Python 3.12 environment on Linux | Installed from requirements.txt and ran all four HTTP integration test groups successfully. |
| Database persistence | Created a visitor, stopped the server, restarted with the same data directory and retrieved the visitor in the existing session. |
| Frontend build | Installed from the npm lockfile and rebuilt the SPA. The resulting JavaScript checksum matched the packaged build. |
| Reception workflows | The compiled React interface ran against the Python API and SQLite in a DOM test environment. Admin registration, sign-in and sign-out, directory and visit CRUD, role-specific controls, check-in, checkout and the contents of daily and monthly CSV downloads were verified. |
| Browser inspection | The sign-in screen and interactive Swagger endpoint list loaded in Chrome. |
| Platform coverage | Windows startup commands and launcher are supplied. Runtime checks used Linux. Mobile styling is included. Physical phone testing was outside this verification run. |
