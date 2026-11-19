import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Landmark,
  LayoutDashboard,
  ClipboardList,
  UsersRound,
  ContactRound,
  ChartNoAxesColumnIncreasing,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  DoorOpen,
  UserRoundCheck,
  UserRoundPlus,
  CircleCheck,
  Search,
  X,
  Menu,
  Pencil,
  Trash2,
  Download,
  MapPin,
  Clock3,
  Building2,
  ChevronRight,
  Mail,
  Phone,
  Fingerprint,
  Plus,
  AlertCircle,
} from "lucide-react";

const paths = {
  overview: ["Overview", LayoutDashboard],
  visits: ["Visit register", ClipboardList],
  visitors: ["Visitors", UsersRound],
  hosts: ["Hosts", ContactRound],
  reports: ["Reports", ChartNoAxesColumnIncreasing],
};
const fields = {
  visitors: [
    ["name", "Full name", true],
    ["organization", "Organisation", false],
    ["email", "Email address", false, "email"],
    ["phone", "Phone number", false, "tel"],
  ],
  hosts: [
    ["name", "Full name", true],
    ["department", "Department", true],
    ["email", "Email address", true, "email"],
  ],
};
const localDay = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const dateLabel = (value, opts = {}) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    ...opts,
  }).format(new Date(value));
const time = (v) =>
  v ? dateLabel(v, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
const blank = { visitors: [], hosts: [], visits: [] };
const sorted = (rows) =>
  [...rows].sort(
    (a, b) => new Date(b.check_in) - new Date(a.check_in) || b.id - a.id,
  );
const initials = (n) =>
  (n || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
function Avatar({ name }) {
  let sum = 0;
  for (const s of name || "A") sum += s.charCodeAt(0);
  return <span className={"avatar tone" + (sum % 5)}>{initials(name)}</span>;
}
function Brand() {
  return (
    <div className="brand">
      <span className="brandIcon">
        <Landmark size={24} />
      </span>
      <span>
        Campus Gate<small>University reception</small>
      </span>
    </div>
  );
}
function Building() {
  return (
    <div className="campus-art" aria-hidden="true">
      <div className="horizon" />
      <div className="spire" />
      <div className="turret">
        <i />
        <i />
      </div>
      <div className="annex a" />
      <div className="annex b" />
      <div className="facade">
        {Array.from({ length: 21 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="steps" />
    </div>
  );
}
async function request(path, method = "GET", data) {
  const res = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    let text = "Request failed. Please try again.";
    try {
      const j = await res.json();
      if (typeof j.detail === "string") text = j.detail;
      else if (Array.isArray(j.detail) && j.detail.length)
        text = j.detail
          .map((x) => [x.loc?.at(-1), x.msg].filter(Boolean).join(" — "))
          .join(". ");
    } catch {}
    throw Object.assign(new Error(text), { status: res.status });
  }
  if (res.status === 204) return null;
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}
function Notice({ children }) {
  return (
    <div role="alert" className="notice">
      <AlertCircle size={17} />
      {children}
    </div>
  );
}
function Auth({ onAuth }) {
  const [mode, setMode] = useState("login"),
    [admin, setAdmin] = useState(false),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setErr("");
    try {
      await request("auth/" + mode, "POST", v);
      await onAuth();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="authStory">
        <Brand />
        <div className="authTitle">
          <span className="eyebrow light">
            <span className="dot" />
            University visitor management
          </span>
          <h1>
            Campus
            <br />
            reception.
          </h1>
          <p>
            One place for visitor check-in, host details and campus records.
          </p>
        </div>
        <Building />
        <div className="authFoot">
          <MapPin size={16} /> University of Colombo
        </div>
      </section>
      <section className="authPanel">
        <div className="authForm">
          <div className="mobileBrand">
            <Brand />
          </div>
          <div className="authSymbol">
            <Fingerprint size={28} />
          </div>
          <h2>{mode === "login" ? "Welcome back" : "Create an account"}</h2>
          <p>
            {mode === "login"
              ? "Sign in to the reception workspace."
              : "Register for access to the reception workspace."}
          </p>
          <form onSubmit={submit} key={mode}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  required
                  name="name"
                  minLength="2"
                  maxLength="100"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                required
                name="email"
                maxLength="254"
                placeholder="you@university.lk"
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                name="password"
                minLength={mode === "register" ? 10 : 1}
                maxLength="128"
                placeholder={
                  mode === "register"
                    ? "At least 10 characters"
                    : "Enter your password"
                }
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            {mode === "register" && (
              <>
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={admin}
                    onChange={(e) => setAdmin(e.target.checked)}
                  />{" "}
                  Register as an administrator
                </label>
                {admin && (
                  <label>
                    Administrator invitation code
                    <input
                      required
                      type="password"
                      name="admin_code"
                      maxLength="128"
                      autoComplete="off"
                    />
                  </label>
                )}
              </>
            )}
            {err && <Notice>{err}</Notice>}
            <button className="primary authSubmit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="switch">
            {mode === "login"
              ? "New to Campus Gate?"
              : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setErr("");
                setAdmin(false);
              }}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
function Modal({ title, children, close, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="modalHead">
        <h2>{title}</h2>
        <button
          type="button"
          className="iconBtn"
          aria-label="Close dialog"
          onClick={close}
          disabled={busy}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function RecordModal({ modal, close, perform, data }) {
  const { kind, action, row } = modal,
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const entity = { visitors: "visitor", hosts: "host", visits: "visit" }[kind];
  const title =
    action === "delete"
      ? "Delete " + entity
      : action === "checkout"
        ? "Check out visitor"
        : action === "edit"
          ? "Edit " + entity
          : kind === "visits"
            ? "Check in visitor"
            : "Add " + entity;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const vals = Object.fromEntries(new FormData(e.currentTarget));
    Object.keys(vals).forEach((k) => (vals[k] = vals[k].trim()));
    try {
      if (kind === "visits" && ["add", "edit"].includes(action)) {
        vals.visitor_id = Number(vals.visitor_id);
        vals.host_id = Number(vals.host_id);
      }
      await perform(modal, vals);
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }
  const active = new Set(
    data.visits.filter((v) => !v.check_out).map((v) => v.visitor_id),
  );
  const eligible = data.visitors.filter(
    (v) => action === "edit" || !active.has(v.id),
  );
  const form = ["add", "edit"].includes(action),
    blocked =
      form && kind === "visits" && (!eligible.length || !data.hosts.length);
  return (
    <Modal title={title} close={close} busy={busy}>
      <form onSubmit={submit}>
        {form ? (
          kind === "visits" ? (
            <>
              <label>
                Visitor
                <select
                  required
                  name="visitor_id"
                  defaultValue={row?.visitor_id || ""}
                >
                  <option value="" disabled>
                    Select a registered visitor
                  </option>
                  {eligible.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.organization ? " · " + v.organization : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Host
                <select
                  required
                  name="host_id"
                  defaultValue={row?.host_id || ""}
                >
                  <option value="" disabled>
                    Select a host
                  </option>
                  {data.hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} · {h.department}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Purpose of visit
                <input
                  name="purpose"
                  required
                  minLength="2"
                  maxLength="240"
                  defaultValue={row?.purpose}
                  placeholder="e.g. Research meeting"
                />
              </label>
              {blocked && (
                <p className="hint">
                  Check-in requires an available registered visitor and a host.
                  Add visitors in the Visitors directory. An administrator can
                  add hosts.
                </p>
              )}
            </>
          ) : (
            fields[kind].map(([key, label, required, type]) => (
              <label key={key}>
                {label}
                {!required && <small>Optional</small>}
                <input
                  required={required}
                  name={key}
                  type={type || "text"}
                  minLength={required && type !== "email" ? 2 : undefined}
                  maxLength={
                    type === "tel"
                      ? 30
                      : type === "email"
                        ? 254
                        : key === "organization"
                          ? 120
                          : 100
                  }
                  defaultValue={row?.[key] || ""}
                />
              </label>
            ))
          )
        ) : (
          <p className="modalCopy">
            {action === "checkout" ? (
              <>
                Record the departure of <strong>{row.visitor_name}</strong> at
                the current time?
              </>
            ) : (
              <>
                Permanently delete {kind === "visits" ? "the visit by " : ""}
                <strong>{row.name || row.visitor_name}</strong>?
              </>
            )}
          </p>
        )}
        {err && <Notice>{err}</Notice>}
        <div className="formActions">
          <button
            className="secondary"
            type="button"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={action === "delete" ? "danger" : "primary"}
            disabled={busy || blocked}
          >
            {busy ? "Saving…" : action === "edit" ? "Save changes" : title}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Badge({ out }) {
  return (
    <span className={"badge " + (out ? "out" : "in")}>
      <i />
      {out ? "Checked out" : "On campus"}
    </span>
  );
}
function Empty({ children }) {
  return (
    <div className="empty">
      <ClipboardList size={28} />
      <p>{children}</p>
    </div>
  );
}
function VisitTable({ rows, open, admin, compact = false, readOnly = false }) {
  return rows.length ? (
    <div className="tableScroll" tabIndex="0" aria-label="Visit records">
      <table>
        <thead>
          <tr>
            <th>Visitor</th>
            <th>Host</th>
            <th>Check-in</th>
            {!compact && <th>Checkout</th>}
            <th>Status</th>
            {!readOnly && (
              <th>
                <span className="sr">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td>
                <div className="person">
                  <Avatar name={v.visitor_name} />
                  <span>
                    <b>{v.visitor_name}</b>
                    <small>{v.purpose}</small>
                  </span>
                </div>
              </td>
              <td data-label="Host">
                <b>{v.host_name}</b>
                <small>{v.department}</small>
              </td>
              <td data-label="Check-in">
                {time(v.check_in)}
                <small>
                  {dateLabel(v.check_in, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </small>
              </td>
              {!compact && (
                <td data-label="Checkout">
                  {time(v.check_out)}
                  {v.check_out && (
                    <small>
                      {dateLabel(v.check_out, {
                        day: "2-digit",
                        month: "short",
                      })}
                    </small>
                  )}
                </td>
              )}
              <td className="statusCell">
                <Badge out={v.check_out} />
              </td>
              {!readOnly && (
                <td className="actionCell">
                  <div className="rowButtons">
                    {!v.check_out && (
                      <button
                        className="mini"
                        title={"Check out " + v.visitor_name}
                        onClick={() => open("visits", "checkout", v)}
                      >
                        Check out
                      </button>
                    )}
                    {admin && !compact && (
                      <>
                        <button
                          className="iconBtn"
                          aria-label={"Edit visit for " + v.visitor_name}
                          onClick={() => open("visits", "edit", v)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="iconBtn"
                          aria-label={"Delete visit for " + v.visitor_name}
                          onClick={() => open("visits", "delete", v)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>No visits match this view.</Empty>
  );
}
function PageHead({ title, sub, children }) {
  return (
    <div className="pageHead">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {children}
    </div>
  );
}
function Overview({ data, open, go }) {
  const now = localDay(),
    today = data.visits.filter((v) => localDay(v.check_in) === now),
    outToday = data.visits.filter(
      (v) => v.check_out && localDay(v.check_out) === now,
    ),
    active = data.visits.filter((v) => !v.check_out);
  return (
    <>
      <div className="hero">
        <div className="heroText">
          <span className="eyebrow light">
            <span className="dot" /> Reception overview
          </span>
          <h1>Campus at a glance</h1>
          <p>
            {dateLabel(new Date(), {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <button className="heroButton" onClick={() => open("visits", "add")}>
            <Plus size={17} />
            Check in visitor
          </button>
        </div>
        <Building />
      </div>
      <div className="metrics">
        {[
          ["Arrivals today", today.length, UserRoundPlus],
          ["On campus", active.length, DoorOpen],
          ["Departures today", outToday.length, UserRoundCheck],
          ["Registered hosts", data.hosts.length, ContactRound],
        ].map(([label, n, I], i) => (
          <div className={"metric m" + i} key={label}>
            <div className="metricLabel">
              <span>{label}</span>
              <I size={18} />
            </div>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panelHead">
          <div>
            <h2>Recent visits</h2>
            <p>Latest arrivals in the university register.</p>
          </div>
          <button className="textBtn" onClick={() => go("visits")}>
            View register
            <ArrowRight size={15} />
          </button>
        </div>
        <VisitTable
          compact
          rows={sorted(data.visits).slice(0, 5)}
          open={open}
        />
      </section>
      <div className="quick">
        {[
          [
            "Add a visitor",
            "Register a new visitor",
            UsersRound,
            () => open("visitors", "add"),
          ],
          [
            "Find a host",
            "Browse university staff",
            ContactRound,
            () => go("hosts"),
          ],
          [
            "Visit reports",
            "Daily and monthly records",
            ChartNoAxesColumnIncreasing,
            () => go("reports"),
          ],
        ].map(([label, sub, I, fn]) => (
          <button onClick={fn} key={label}>
            <span className="quickIcon">
              <I size={19} />
            </span>
            <span>
              <b>{label}</b>
              <small>{sub}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
    </>
  );
}
function SearchBox({ query, setQuery, placeholder }) {
  return (
    <div className="search">
      <Search size={17} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}
function Directory({ kind, data, admin, open }) {
  const [q, setQ] = useState("");
  const hosts = kind === "hosts";
  const rows = data[kind]
    .filter((r) =>
      fields[kind].some(([f]) =>
        String(r[f] || "")
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHead
        title={paths[kind][0]}
        sub={
          hosts
            ? "University staff available to receive visitors."
            : "Registered guests and their contact details."
        }
      >
        {(!hosts || admin) && (
          <button className="primary" onClick={() => open(kind, "add")}>
            <Plus size={17} />
            Add {hosts ? "host" : "visitor"}
          </button>
        )}
      </PageHead>
      <div className="filterBar">
        <SearchBox
          query={q}
          setQuery={setQ}
          placeholder={
            hosts
              ? "Search hosts or departments"
              : "Search visitors or organisations"
          }
        />
        <span className="muted">
          {rows.length} {kind}
        </span>
      </div>
      {rows.length ? (
        <div className="cards">
          {rows.map((r) => (
            <article className="personCard" key={r.id}>
              <div className="cardHead">
                <Avatar name={r.name} />
                {admin && (
                  <div className="rowButtons">
                    <button
                      className="iconBtn"
                      aria-label={"Edit " + r.name}
                      onClick={() => open(kind, "edit", r)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="iconBtn"
                      aria-label={"Delete " + r.name}
                      onClick={() => open(kind, "delete", r)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <h2>{r.name}</h2>
              <p className="affiliation">
                <Building2 size={15} />
                {r.department || r.organization || "Independent visitor"}
              </p>
              <div className="contacts">
                {r.email && (
                  <span>
                    <Mail size={15} />
                    {r.email}
                  </span>
                )}
                {r.phone && (
                  <span>
                    <Phone size={15} />
                    {r.phone}
                  </span>
                )}
                {!r.email && !r.phone && <span>No contact details</span>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty>No {kind} match this view.</Empty>
      )}
    </>
  );
}
function Visits({ data, open, admin }) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("all");
  const rows = sorted(data.visits).filter(
    (v) =>
      (status === "all" || (status === "out") === !!v.check_out) &&
      [v.visitor_name, v.host_name, v.department, v.purpose].some((s) =>
        (s || "").toLowerCase().includes(q.trim().toLowerCase()),
      ),
  );
  return (
    <>
      <PageHead
        title="Visit register"
        sub="Track arrivals, departures and visit details."
      >
        <button className="primary" onClick={() => open("visits", "add")}>
          <Plus size={17} />
          Check in visitor
        </button>
      </PageHead>
      <section className="panel">
        <div className="filterBar inPanel">
          <SearchBox query={q} setQuery={setQ} placeholder="Search visits" />
          <select
            aria-label="Visit status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="in">On campus</option>
            <option value="out">Checked out</option>
          </select>
        </div>
        <VisitTable rows={rows} admin={admin} open={open} />
      </section>
    </>
  );
}
function Reports() {
  const [kind, setKind] = useState("daily"),
    [daily, setDaily] = useState(localDay()),
    [monthly, setMonthly] = useState(localDay().slice(0, 7)),
    [state, setReportState] = useState({}),
    [downloading, setDownloading] = useState(false),
    [exportErr, setExportError] = useState("");
  const period = kind === "daily" ? daily : monthly;
  const path = "reports/" + kind + "?period=" + encodeURIComponent(period);
  useEffect(() => {
    let live = true;
    setReportState({});
    setExportError("");
    if (period)
      request(path)
        .then((report) => live && setReportState({ report, path }))
        .catch((e) => live && setReportState({ error: e.message, path }));
    return () => {
      live = false;
    };
  }, [path, period]);
  const report = state.path === path ? state.report : null;
  async function download() {
    setDownloading(true);
    setExportError("");
    try {
      const res = await fetch("/api/" + path + "&format=csv");
      if (!res.ok)
        throw Error("Download failed. Check your session and try again.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "Campus-Gate-" + kind + "-" + period + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setExportError(e.message);
    } finally {
      setDownloading(false);
    }
  }
  return (
    <>
      <PageHead
        title="Reports"
        sub="Review campus visits by check-in date and download the records."
      />
      <section className="panel report">
        <div className="panelHead">
          <div className="tabs" aria-label="Report period">
            {["daily", "monthly"].map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {k === "daily" ? "Daily" : "Monthly"}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            disabled={!report || downloading}
            onClick={download}
          >
            <Download size={17} />
            {downloading ? "Downloading…" : "Download CSV"}
          </button>
        </div>
        <div className="reportFilter">
          <label>
            {kind === "daily" ? "Report date" : "Report month"}
            <input
              required
              type={kind === "daily" ? "date" : "month"}
              value={period}
              onChange={(e) =>
                (kind === "daily" ? setDaily : setMonthly)(e.target.value)
              }
            />
          </label>
          <span className="muted">
            <Clock3 size={15} /> Sri Lanka time
          </span>
        </div>
        {exportErr && <Notice>{exportErr}</Notice>}
        {state.error && <Notice>{state.error}</Notice>}
        {report ? (
          <>
            <div className="totals">
              {[
                ["Total visits", report.total],
                ["Still on campus", report.on_campus],
                ["Checked out", report.checked_out],
              ].map(([l, v]) => (
                <div key={l}>
                  <small>{l}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <VisitTable rows={sorted(report.rows)} readOnly />
          </>
        ) : (
          !state.error && (
            <p className="loading">
              {period ? "Loading report…" : "Select a period to view records."}
            </p>
          )
        )}
      </section>
    </>
  );
}
function route() {
  const key = location.hash.slice(1);
  return Object.hasOwn(paths, key) ? key : "overview";
}
function App() {
  const [user, setUser] = useState(undefined),
    [data, setData] = useState(blank),
    [page, setPage] = useState(route),
    [drawer, setDrawer] = useState(false),
    [modal, setModal] = useState(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function refresh() {
    const [visitors, hosts, visits] = await Promise.all(
      ["visitors", "hosts", "visits"].map((p) => request(p)),
    );
    setData({ visitors, hosts, visits });
    setError("");
  }
  async function init() {
    setLoading(true);
    setError("");
    try {
      setUser(await request("auth/me"));
      await refresh();
    } catch (e) {
      if (e.status === 401) {
        setUser(null);
        setData(blank);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    init();
    const fn = () => {
      setPage(route());
      setDrawer(false);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!drawer) return;
    const fn = (e) => {
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [drawer]);
  const go = (p) => {
    location.hash = p;
    setPage(p);
    setDrawer(false);
    window.scrollTo(0, 0);
  };
  const open = (kind, action, row) => setModal({ kind, action, row });
  async function logout() {
    try {
      await request("auth/logout", "POST");
      setUser(null);
      setData(blank);
      setDrawer(false);
      setModal(null);
      setMessage("");
      go("overview");
    } catch (e) {
      setError(e.message);
    }
  }
  async function perform({ kind, action, row }, v) {
    const url =
      kind +
      (row ? "/" + row.id : "") +
      (action === "checkout" ? "/checkout" : "");
    await request(
      url,
      { add: "POST", edit: "PUT", checkout: "POST", delete: "DELETE" }[action],
      ["add", "edit"].includes(action) ? v : undefined,
    );
    setModal(null);
    setMessage(
      action === "checkout"
        ? "Visitor checked out."
        : action === "add" && kind === "visits"
          ? "Visitor checked in."
          : action === "delete"
            ? "Record deleted."
            : "Record saved.",
    );
    try {
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  if (user === undefined)
    return (
      <main className="splash">
        <Brand />
        {error ? (
          <>
            <Notice>{error}</Notice>
            <button className="secondary" onClick={init}>
              Try again
            </button>
          </>
        ) : (
          <p>Opening reception…</p>
        )}
      </main>
    );
  if (!user) return <Auth onAuth={init} />;
  const admin = user.role === "admin";
  return (
    <div className="layout">
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main").focus();
        }}
      >
        Skip to content
      </a>
      {drawer && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={drawer ? "sidebar open" : "sidebar"}>
        <Brand />
        <div className="navLabel">Workspace</div>
        <nav>
          {Object.entries(paths).map(([p, [name, I]]) => (
            <a
              key={p}
              href={"#" + p}
              className={page === p ? "selected" : ""}
              aria-current={page === p ? "page" : undefined}
              onClick={() => setDrawer(false)}
            >
              <I size={19} />
              {name}
              {page === p && <span className="navDot" />}
            </a>
          ))}
        </nav>
        <div className="sidebarFoot">
          <div className="profile">
            <Avatar name={user.name} />
            <span>
              <b>{user.name}</b>
              <small>{admin ? "Administrator" : "Reception user"}</small>
            </span>
          </div>
          <button className="logout" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="body">
        <header className="top">
          <button
            className="menu iconBtn"
            aria-label="Open navigation"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <Menu size={22} />
          </button>
          <span className="crumb">
            Reception <ChevronRight size={14} /> <b>{paths[page][0]}</b>
          </span>
          <span className="campus">
            <MapPin size={15} />
            University of Colombo
          </span>
        </header>
        <main id="main" tabIndex="-1">
          {error && (
            <div>
              <Notice>{error}</Notice>
              <button className="textBtn" onClick={init}>
                Reload workspace
              </button>
            </div>
          )}
          {loading ? (
            <p className="loading">Loading workspace…</p>
          ) : page === "overview" ? (
            <Overview data={data} open={open} go={go} />
          ) : page === "visits" ? (
            <Visits data={data} open={open} admin={admin} />
          ) : page === "reports" ? (
            <Reports />
          ) : (
            <Directory
              key={page}
              kind={page}
              data={data}
              admin={admin}
              open={open}
            />
          )}
        </main>
      </div>
      {modal && (
        <RecordModal
          modal={modal}
          close={() => setModal(null)}
          perform={perform}
          data={data}
        />
      )}
      <div aria-live="polite" className={message ? "toast" : "sr"}>
        {message && (
          <>
            <CircleCheck size={17} />
            {message}
          </>
        )}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
