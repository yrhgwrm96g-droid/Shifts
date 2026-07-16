"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
  });
const fmtDateLong = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });
const shiftKind = (start) => {
  const h = parseInt(start.slice(0, 2));
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 20) return "afternoon";
  return "night";
};
const SHIFT_TYPES = [
  { label: "Morning", time: "07–15", start: "07:00", end: "15:00" },
  { label: "Afternoon", time: "15–23", start: "15:00", end: "23:00" },
  { label: "Night", time: "23–07", start: "23:00", end: "07:00" },
];

/* ---------------- Users tab (admins only) ---------------- */
function UsersTab() {
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState({ username: "", name: "", temp_password: "", role: "user" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function add() {
    setError(""); setOk("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed");
    setOk(`Account "${form.username}" created — give them the username and temporary password.`);
    setForm({ username: "", name: "", temp_password: "", role: "user" });
    load();
  }
  async function resetPassword(id, username) {
    const temp = prompt(`New temporary password for ${username} (min 8 characters):`);
    if (!temp) return;
    setError(""); setOk("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset_id: id, temp_password: temp }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed");
    setOk(`Password reset for ${username}. They must change it on next login.`);
    load();
  }
  async function remove(id) {
    if (!confirm("Remove this user and all their shifts?")) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Create an account</h2>
        <p className="muted">They set their own password on first login.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="field grow">Username
            <input placeholder="e.g. nino.k" value={form.username} onChange={set("username")} />
          </label>
          <label className="field grow">Full name (optional)
            <input placeholder="e.g. Nino K." value={form.name} onChange={set("name")} />
          </label>
          <label className="field grow">Temporary password
            <input placeholder="min 8 characters" value={form.temp_password} onChange={set("temp_password")} />
          </label>
          <label className="field">Role
            <select value={form.role} onChange={set("role")}>
              <option value="user">User (has shifts)</option>
              <option value="manager">Manager (approves deals)</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="btn primary" onClick={() => add(false)}
            disabled={!form.username || !form.temp_password}>Create</button>
        </div>
        {error && <p className="error">{error}</p>}
        {ok && <p className="success">{ok}</p>}
      </div>
      <div className="card">
        <h2>Team ({users?.length ?? "…"})</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Password</th><th></th></tr></thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.name || "—"}</td>
                <td>{u.role}</td>
                <td className="muted">{u.must_change_password ? "Temporary" : "Set by user"}</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <button className="btn small" onClick={() => resetPassword(u.id, u.username)}>Reset password</button>{" "}
                  <button className="btn small danger" onClick={() => remove(u.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

/* ---------------- Shifts tab (admins + managers) ---------------- */
function ShiftsTab() {
  const today = new Date();
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState(null);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [shiftType, setShiftType] = useState(0); // index into SHIFT_TYPES, -1 = custom
  const [custom, setCustom] = useState({ start: "07:00", end: "15:00" });
  const [pattern, setPattern] = useState("rota33");
  const [date, setDate] = useState("");
  const [until, setUntil] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("");
  const [selected, setSelected] = useState(null);   // shift being acted on
  const [swapFirst, setSwapFirst] = useState(null); // shift picked first for manual swap
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [warning, setWarning] = useState(null); // capacity warning from server

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const gridStart = new Date(month);
  gridStart.setDate(1 - ((month.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  const gridEnd = cells[41];

  const shiftKind = (start) => {
    const h = parseInt(start.slice(0, 2));
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 20) return "afternoon";
    return "night";
  };

  async function load() {
    const [a, b] = await Promise.all([
      fetch("/api/admin/users"),
      fetch(`/api/admin/shifts?from=${iso(gridStart)}&to=${iso(gridEnd)}`),
    ]);
    setUsers((await a.json()).users || []);
    setShifts((await b.json()).shifts || []);
  }
  useEffect(() => { setShifts(null); setSelected(null); load(); }, [month]);

  const toggleUser = (id) =>
    setSelectedUsers((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  const times = shiftType === -1 ? custom : { start: SHIFT_TYPES[shiftType].start, end: SHIFT_TYPES[shiftType].end };

  async function add(force = false) {
    setError(""); setOk(""); if (!force) setWarning(null);
    setBusy(true);
    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_ids: selectedUsers,
        date,
        start_time: times.start,
        end_time: times.end,
        pattern,
        repeat_until: pattern === "single" ? undefined : until,
        force,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 409 && data.overcapacity) {
      setWarning(data);
      return;
    }
    if (!res.ok) return setError(data.error || "Failed");
    setWarning(null);
    setOk(`Created ${data.created} shift(s).`);
    load();
  }

  async function api(method, body, successMsg) {
    setError(""); setOk("");
    const res = await fetch("/api/admin/shifts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed");
    if (successMsg) setOk(successMsg);
    setSelected(null); setSwapFirst(null);
    load();
  }

  function onChipClick(s) {
    if (swapFirst && swapFirst.id !== s.id) {
      if (!confirm(`Swap owners?\n${swapFirst.users?.name || swapFirst.users?.username}: ${swapFirst.date} ${swapFirst.start_time.slice(0,5)}\n⇅\n${s.users?.name || s.users?.username}: ${s.date} ${s.start_time.slice(0,5)}`)) return;
      api("PATCH", { swap: [swapFirst.id, s.id] }, "Shifts swapped — both members were notified.");
      return;
    }
    setSelected(selected?.id === s.id ? null : s);
  }

  const filtered = (shifts || []).filter((s) => {
    if (kindFilter !== "all" && shiftKind(s.start_time) !== kindFilter) return false;
    if (personFilter && s.user_id !== personFilter) return false;
    return true;
  });
  const byDate = {};
  filtered.forEach((s) => { (byDate[s.date] ||= []).push(s); });

  const members = users.filter((u) => u.role === "user");
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayIso = iso(new Date());

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Add shifts</h2>
          <button className="btn small" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Hide" : "Open"}
          </button>
        </div>
        {showForm && (
          <>
            <p className="muted" style={{ margin: "10px 0 6px" }}>1 · Who is working? (tap to select several)</p>
            <div className="user-chips">
              {users.map((u) => (
                <button key={u.id}
                  className={`user-chip ${selectedUsers.includes(u.id) ? "on" : ""}`}
                  onClick={() => toggleUser(u.id)}>
                  {u.name || u.username}
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: "14px 0 6px" }}>2 · Which shift?</p>
            <div className="user-chips">
              {SHIFT_TYPES.map((t, i) => (
                <button key={t.label}
                  className={`user-chip ${shiftType === i ? "on" : ""}`}
                  onClick={() => setShiftType(i)}>
                  {t.label} {t.time}
                </button>
              ))}
              <button className={`user-chip ${shiftType === -1 ? "on" : ""}`} onClick={() => setShiftType(-1)}>
                Custom…
              </button>
            </div>
            {shiftType === -1 && (
              <div className="row" style={{ marginTop: 8 }}>
                <label className="field">Start
                  <input type="time" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} />
                </label>
                <label className="field">End
                  <input type="time" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} />
                </label>
              </div>
            )}
            <p className="muted" style={{ margin: "14px 0 6px" }}>3 · How often?</p>
            <div className="row">
              <label className="field">Pattern
                <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                  <option value="rota33">3 days on / 3 days off</option>
                  <option value="weekly">Same day every week</option>
                  <option value="single">One single day</option>
                </select>
              </label>
              <label className="field">
                {pattern === "rota33" ? "First day of a 3-day work block" : "Date"}
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              {pattern !== "single" && (
                <label className="field">Repeat until
                  <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                </label>
              )}
              <button className="btn primary" onClick={() => add(false)}
                disabled={busy || selectedUsers.length === 0 || !date || (pattern !== "single" && !until)}>
                {busy ? "Creating…" : `Create for ${selectedUsers.length || "…"} member(s)`}
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Tip: tap a day on the calendar below to put its date into this form.
            </p>
          </>
        )}
        {error && <p className="error">{error}</p>}
        {ok && <p className="success">{ok}</p>}
        {warning && (
          <div className="card" style={{ borderColor: "var(--amber)", marginTop: 10 }}>
            <strong style={{ color: "var(--amber)" }}>⚠ Already 5 members on the {warning.kind} shift</strong>
            <p className="muted" style={{ margin: "6px 0" }}>
              These day(s) already have 5 (or would exceed 5) members working the {warning.kind} shift:
            </p>
            <p style={{ margin: "4px 0 10px" }}>
              {warning.counts.map((c) =>
                `${new Date(c.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })} (${c.existing} already)`
              ).join(" · ")}
            </p>
            <div className="row">
              <button className="btn primary" onClick={() => add(true)} disabled={busy}>Create anyway</button>
              <button className="btn" onClick={() => setWarning(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="row row-nav" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
        <h2 style={{ margin: 0 }}>{monthLabel}</h2>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
      </div>

      <div className="filter-bar">
        {[["all", "All"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["night", "Night"]].map(([k, label]) => (
          <button key={k}
            className={`user-chip ${kindFilter === k ? "on" : ""}`}
            onClick={() => setKindFilter(k)}>{label}</button>
        ))}
        <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
          <option value="">Everyone</option>
          {members.map((u) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
        </select>
      </div>

      {swapFirst && (
        <div className="card" style={{ borderColor: "var(--amber)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              <strong>Swap mode:</strong> first shift selected —{" "}
              {swapFirst.users?.name || swapFirst.users?.username}, {fmtDate(swapFirst.date)}{" "}
              {fmtTime(swapFirst.start_time)}–{fmtTime(swapFirst.end_time)}. Now click the second shift on the calendar.
            </span>
            <button className="btn small" onClick={() => setSwapFirst(null)}>✕ Cancel</button>
          </div>
        </div>
      )}

      {selected && !swapFirst && (
        <div className="card" style={{ borderColor: "var(--green)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>
              {selected.users?.name || selected.users?.username} · {fmtDate(selected.date)} ·{" "}
              {fmtTime(selected.start_time)}–{fmtTime(selected.end_time)}
              {selected.status !== "normal" && (
                <span className={`badge ${selected.status === "offered" ? "offered" : "accepted"}`} style={{ marginLeft: 8 }}>
                  {selected.status}
                </span>
              )}
            </h2>
            <button className="btn small" onClick={() => setSelected(null)}>✕ Close</button>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <label className="field">Reassign to
              <select defaultValue="" onChange={(e) => e.target.value && api("PATCH", { id: selected.id, user_id: e.target.value }, "Shift reassigned — both members were notified.")}>
                <option value="">— choose member —</option>
                {members.filter((u) => u.id !== selected.user_id).map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.username}</option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={() => { setSwapFirst(selected); setSelected(null); }}>
              Swap with another shift…
            </button>
            <button className="btn danger"
              onClick={() => confirm("Delete this shift?") && api("DELETE", { id: selected.id }, "Shift deleted — the member was notified.")}>
              Delete shift
            </button>
          </div>
        </div>
      )}

      <div className="cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="cal-head">{d}</div>
        ))}
        {cells.map((d) => {
          const key = iso(d);
          const inMonth = d.getMonth() === month.getMonth();
          const dayShifts = byDate[key] || [];
          return (
            <div key={key}
              className={`cal-cell ${inMonth ? "" : "out"} ${key === todayIso ? "today" : ""}`}
              onClick={() => { setDate(key); setShowForm(true); }}
              style={{ cursor: "pointer" }}>
              <div className="cal-daynum" style={{ display: "flex" }}>
                {d.getDate()}
                {(() => {
                  const kc = { morning: 0, afternoon: 0, night: 0 };
                  ((byDate[key]) || []).forEach((s) => { kc[shiftKind(s.start_time)]++; });
                  const full = Object.entries(kc).filter(([, n]) => n >= 5).map(([k]) => k);
                  return full.length > 0
                    ? <span className="warn-badge" title={`5+ members on: ${full.join(", ")}`}>⚠{full.length > 1 ? full.length : ""}</span>
                    : null;
                })()}
              </div>
              {dayShifts.map((s) => {
                const kind = shiftKind(s.start_time);
                const isPicked = selected?.id === s.id || swapFirst?.id === s.id;
                return (
                  <button
                    key={s.id}
                    className={`shift-chip clickable ${kind} ${s.status === "offered" ? "is-offered" : ""}`}
                    style={isPicked ? { outline: "2px solid var(--green)" } : undefined}
                    onClick={(e) => { e.stopPropagation(); onChipClick(s); }}
                    title={`${s.users?.name || s.users?.username} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`}>
                    {(s.users?.name || s.users?.username || "").split(" ")[0]}{" "}
                    <span className="chip-time">{fmtTime(s.start_time)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Click a shift to reassign, swap, or delete it. Click an empty day to prefill the add-shifts form.
      </p>
      {shifts !== null && filtered.length === 0 && <p className="empty">No shifts this month.</p>}
    </>
  );
}

/* ---------------- Activity tab ---------------- */
function ActivityTab() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    fetch("/api/admin/swaps").then((r) => r.json()).then((d) => setRows(d.requests || []));
  }, []);

  return (
    <div className="card">
      <h2>Giveaway & swap activity</h2>
      <p className="muted">Latest 100 requests — who offered what, and who took it.</p>
      {rows === null && <p className="empty">Loading…</p>}
      {rows?.length === 0 && <p className="empty">No activity yet.</p>}
      <div className="table-wrap"><table>
        <thead><tr><th>Shift</th><th>Type</th><th>From</th><th>To</th><th>Status</th></tr></thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.id}>
              <td>{r.shifts ? `${fmtDate(r.shifts.date)} · ${fmtTime(r.shifts.start_time)}–${fmtTime(r.shifts.end_time)}` : "—"}</td>
              <td>
                <span className={`badge ${r.type}`}>
                  {r.type === "swap" ? "Swap" :
                    r.portion === "first4" ? "Giveaway · first 4h" :
                    r.portion === "last4" ? "Giveaway · last 4h" : "Giveaway"}
                </span>
              </td>
              <td>{r.from?.name || r.from?.username || "—"}</td>
              <td>{r.to?.name || r.to?.username || "—"}</td>
              <td><span className={`badge ${r.status}`}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

/* ---------------- Page ---------------- */
function AdminInner() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState("shifts");
  if (status === "loading") return <p className="empty">Loading…</p>;
  const role = session?.user?.role;
  if (!["admin", "manager"].includes(role))
    return <p className="empty">This page is for administrators and Senior Service Managers.</p>;
  const isAdmin = role === "admin";
  return (
    <>
      <h1>{isAdmin ? "Admin panel" : "Shift management"}</h1>
      <div className="tabs">
        <button className={tab === "shifts" ? "active" : ""} onClick={() => setTab("shifts")}>Shifts</button>
        {isAdmin && (
          <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Users</button>
        )}
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>Activity</button>
      </div>
      {tab === "shifts" && <ShiftsTab />}
      {tab === "users" && isAdmin && <UsersTab />}
      {tab === "activity" && <ActivityTab />}
    </>
  );
}

export default function AdminPage() {
  return <Shell><AdminInner /></Shell>;
}
