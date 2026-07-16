"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const iso = (d) => d.toISOString().slice(0, 10);
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
          <button className="btn primary" onClick={add}
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

  // add-shifts wizard
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [shiftType, setShiftType] = useState(0);
  const [custom, setCustom] = useState({ start: "07:00", end: "15:00" });
  const [pattern, setPattern] = useState("rota33");
  const [date, setDate] = useState("");
  const [until, setUntil] = useState("");
  const [showWizard, setShowWizard] = useState(false);

  // calendar interactions
  const [action, setAction] = useState(null);      // shift selected for edit
  const [swapFirst, setSwapFirst] = useState(null); // shift picked as first in a manual swap
  const [personFilter, setPersonFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, b] = await Promise.all([fetch("/api/admin/users"), fetch("/api/admin/shifts")]);
    setUsers((await a.json()).users || []);
    setShifts((await b.json()).shifts || []);
  }
  useEffect(() => { load(); }, []);

  const flash = (msg) => { setOk(msg); setError(""); setTimeout(() => setOk(""), 5000); };
  const fail = (msg) => { setError(msg); setOk(""); };

  /* --- wizard --- */
  const toggleUser = (id) =>
    setSelectedUsers((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  const times = shiftType === -1 ? custom : { start: SHIFT_TYPES[shiftType].start, end: SHIFT_TYPES[shiftType].end };

  async function addShifts() {
    setBusy(true); setError("");
    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_ids: selectedUsers, date,
        start_time: times.start, end_time: times.end,
        pattern, repeat_until: pattern === "single" ? undefined : until,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return fail(data.error || "Failed");
    flash(`Created ${data.created} shift(s).`);
    load();
  }

  /* --- calendar actions --- */
  async function reassign(shiftId, userId) {
    const res = await fetch("/api/admin/shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shiftId, user_id: userId }),
    });
    const data = await res.json();
    if (!res.ok) return fail(data.error || "Failed");
    flash("Shift reassigned — both members were notified.");
    setAction(null); load();
  }

  async function manualSwap(secondId) {
    const res = await fetch("/api/admin/shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swap: [swapFirst.id, secondId] }),
    });
    const data = await res.json();
    setSwapFirst(null); setAction(null);
    if (!res.ok) return fail(data.error || "Failed");
    flash("Shifts swapped — both members were notified.");
    load();
  }

  async function removeShift(id) {
    if (!confirm("Delete this shift?")) return;
    const res = await fetch("/api/admin/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) return fail(data.error || "Failed");
    flash("Shift deleted — the member was notified.");
    setAction(null); load();
  }

  async function clearRange() {
    if (!personFilter) return fail("Pick a member in the filter first, then clear their range.");
    const from = prompt("Delete this member's shifts FROM date (YYYY-MM-DD):");
    if (!from) return;
    const to = prompt("...TO date (YYYY-MM-DD):");
    if (!to) return;
    if (!confirm(`Delete ALL shifts for this member from ${from} to ${to}?`)) return;
    await fetch("/api/admin/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: personFilter, from, to }),
    });
    flash("Range cleared."); load();
  }

  /* --- calendar grid --- */
  const gridStart = new Date(month);
  gridStart.setDate(1 - ((month.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  const filtered = (shifts || []).filter((s) => {
    if (kindFilter !== "all" && shiftKind(s.start_time) !== kindFilter) return false;
    if (personFilter && s.user_id !== personFilter) return false;
    return true;
  });
  const byDate = {};
  filtered.forEach((s) => { (byDate[s.date] ||= []).push(s); });
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayIso = iso(new Date());
  const members = users.filter((u) => u.role === "user");

  return (
    <>
      {/* Add-shifts wizard (collapsible) */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Add shifts</h2>
          <button className="btn small" onClick={() => setShowWizard(!showWizard)}>
            {showWizard ? "Hide" : "Open"}
          </button>
        </div>
        {showWizard && (
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
              <button className="btn primary" onClick={addShifts}
                disabled={busy || selectedUsers.length === 0 || !date || (pattern !== "single" && !until)}>
                {busy ? "Creating…" : `Create for ${selectedUsers.length || "…"} member(s)`}
              </button>
            </div>
            {pattern === "rota33" && (
              <p className="muted" style={{ marginTop: 8 }}>
                Tip: enter the first day of a working block — e.g. if the group works Aug 3, 4, 5, enter Aug 3.
              </p>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
        {ok && <p className="success">{ok}</p>}
      </div>

      {/* Action panel for the clicked shift */}
      {action && (
        <div className="card" style={{ borderColor: "var(--green)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>
              {fmtDateLong(action.date)} · {fmtTime(action.start_time)}–{fmtTime(action.end_time)}
              <span className="muted" style={{ fontWeight: 400 }}> — {action.users?.name || action.users?.username}</span>
            </h2>
            <button className="btn small" onClick={() => { setAction(null); setSwapFirst(null); }}>✕ Close</button>
          </div>
          {action.status === "offered" && (
            <p className="muted">This shift is currently offered on the marketplace — moving it will cancel the offer.</p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <label className="field">Reassign to
              <select defaultValue="" onChange={(e) => e.target.value && reassign(action.id, e.target.value)}>
                <option value="">— choose member —</option>
                {members.filter((u) => u.id !== action.user_id).map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.username}</option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={() => { setSwapFirst(action); setAction(null); }}>
              Swap with another shift…
            </button>
            <button className="btn danger" onClick={() => removeShift(action.id)}>Delete shift</button>
          </div>
        </div>
      )}

      {/* Swap-mode banner */}
      {swapFirst && (
        <div className="card" style={{ borderColor: "var(--amber)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              <strong>Swap mode:</strong> now click the second shift on the calendar.
              Swapping {fmtDate(swapFirst.date)} {fmtTime(swapFirst.start_time)}–{fmtTime(swapFirst.end_time)}{" "}
              ({swapFirst.users?.name || swapFirst.users?.username}) with…
            </span>
            <button className="btn small" onClick={() => setSwapFirst(null)}>✕ Cancel</button>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>← Prev</button>
          <h2 style={{ margin: 0 }}>{monthLabel}</h2>
          <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next →</button>
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
          <button className="btn small danger" onClick={clearRange}>Clear a date range…</button>
        </div>

        <div className="cal">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="cal-head">{d}</div>
          ))}
          {cells.map((d) => {
            const key = iso(d);
            const inMonth = d.getMonth() === month.getMonth();
            const dayShifts = byDate[key] || [];
            return (
              <div key={key} className={`cal-cell ${inMonth ? "" : "out"} ${key === todayIso ? "today" : ""}`}>
                <div className="cal-daynum">{d.getDate()}</div>
                {dayShifts.map((s) => {
                  const kind = shiftKind(s.start_time);
                  const isSwapSource = swapFirst?.id === s.id;
                  return (
                    <button key={s.id}
                      className={`shift-chip ${kind} clickable ${s.status === "offered" ? "is-offered" : ""}`}
                      style={isSwapSource ? { outline: "2px solid var(--amber)" } : undefined}
                      title={`${(s.users?.name || s.users?.username)} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)} — click to ${swapFirst ? "swap" : "edit"}`}
                      onClick={() => {
                        if (swapFirst) {
                          if (s.id !== swapFirst.id) manualSwap(s.id);
                        } else {
                          setAction(s);
                        }
                      }}>
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
          Click any shift to reassign, swap, or delete it. Past days are not shown.
        </p>
      </div>
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
