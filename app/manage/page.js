"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
  });
const shiftLabel = (s) =>
  `${fmtDate(s.date)} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)} — ${s.users?.name || s.users?.username}`;

const SHIFT_TYPES = [
  { label: "Morning", time: "07–15", start: "07:00", end: "15:00" },
  { label: "Afternoon", time: "15–23", start: "15:00", end: "23:00" },
  { label: "Night", time: "23–07", start: "23:00", end: "07:00" },
];

function AddShifts({ users, onCreated }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [shiftType, setShiftType] = useState(0);
  const [custom, setCustom] = useState({ start: "07:00", end: "15:00" });
  const [pattern, setPattern] = useState("single");
  const [date, setDate] = useState("");
  const [until, setUntil] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleUser = (id) =>
    setSelectedUsers((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  const times = shiftType === -1 ? custom : { start: SHIFT_TYPES[shiftType].start, end: SHIFT_TYPES[shiftType].end };

  async function add() {
    setError(""); setOk(""); setBusy(true);
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
    if (!res.ok) return setError(data.error || "Failed");
    setOk(`Created ${data.created} shift(s).`);
    onCreated();
  }

  const staff = users.filter((u) => u.role === "user" || u.role === "admin");

  return (
    <div className="card">
      <h2>Add shifts</h2>
      <p className="muted" style={{ margin: "10px 0 6px" }}>Who?</p>
      <div className="user-chips">
        {staff.map((u) => (
          <button key={u.id}
            className={`user-chip ${selectedUsers.includes(u.id) ? "on" : ""}`}
            onClick={() => toggleUser(u.id)}>
            {u.name || u.username}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: "14px 0 6px" }}>Which shift?</p>
      <div className="user-chips">
        {SHIFT_TYPES.map((t, i) => (
          <button key={t.label}
            className={`user-chip ${shiftType === i ? "on" : ""}`}
            onClick={() => setShiftType(i)}>
            {t.label} {t.time}
          </button>
        ))}
        <button className={`user-chip ${shiftType === -1 ? "on" : ""}`} onClick={() => setShiftType(-1)}>Custom…</button>
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
      <div className="row" style={{ marginTop: 14 }}>
        <label className="field">Pattern
          <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
            <option value="single">One single day</option>
            <option value="rota33">3 days on / 3 days off</option>
            <option value="weekly">Same day every week</option>
          </select>
        </label>
        <label className="field">
          {pattern === "rota33" ? "First day of a 3-day block" : "Date"}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {pattern !== "single" && (
          <label className="field">Repeat until
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
        )}
        <button className="btn primary" onClick={add}
          disabled={busy || selectedUsers.length === 0 || !date || (pattern !== "single" && !until)}>
          {busy ? "Creating…" : "Create"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {ok && <p className="success">{ok}</p>}
    </div>
  );
}

function ManualSwap({ shifts, onDone }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function swap() {
    setError(""); setOk("");
    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swap_two: [a, b] }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed");
    setOk("Shifts swapped. Both members were notified and the deal appears in Approvals.");
    setA(""); setB("");
    onDone();
  }

  return (
    <div className="card">
      <h2>Swap two shifts (real-life request)</h2>
      <p className="muted">Pick the two shifts to exchange. Owners are notified automatically.</p>
      <div className="row" style={{ marginTop: 8 }}>
        <select className="grow" value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">— First shift —</option>
          {shifts.map((s) => <option key={s.id} value={s.id}>{shiftLabel(s)}</option>)}
        </select>
        <span className="muted">↔</span>
        <select className="grow" value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">— Second shift —</option>
          {shifts.map((s) => <option key={s.id} value={s.id}>{shiftLabel(s)}</option>)}
        </select>
        <button className="btn primary" onClick={swap} disabled={!a || !b || a === b}>Swap</button>
      </div>
      {error && <p className="error">{error}</p>}
      {ok && <p className="success">{ok}</p>}
    </div>
  );
}

function EditRow({ shift, users, onDone, onCancel }) {
  const [form, setForm] = useState({
    user_id: shift.user_id,
    date: shift.date,
    start_time: shift.start_time.slice(0, 5),
    end_time: shift.end_time.slice(0, 5),
  });
  const [error, setError] = useState("");
  const staff = users.filter((u) => u.role === "user" || u.role === "admin");

  async function save() {
    setError("");
    const res = await fetch("/api/admin/shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shift.id, ...form }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed");
    onDone();
  }

  return (
    <div className="card" style={{ borderColor: "var(--green)", margin: "6px 0" }}>
      <div className="row">
        <label className="field grow">Member
          <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
          </select>
        </label>
        <label className="field">Date
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="field">Start
          <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        </label>
        <label className="field">End
          <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </label>
        <button className="btn primary" onClick={save}>Save</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ManageInner() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState(null);
  const [filterUser, setFilterUser] = useState("");
  const [editing, setEditing] = useState(null);

  async function load() {
    const [a, b] = await Promise.all([fetch("/api/team"), fetch("/api/admin/shifts")]);
    setUsers((await a.json()).users || []);
    setShifts((await b.json()).shifts || []);
  }
  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  if (status === "loading") return <p className="empty">Loading…</p>;
  if (!["manager", "admin"].includes(session?.user?.role))
    return <p className="empty">This page is for Senior Service Managers and admins.</p>;

  async function removeShift(id) {
    if (!confirm("Delete this shift? The member will be notified.")) return;
    await fetch("/api/admin/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const visible = (shifts || []).filter((s) => !filterUser || s.user_id === filterUser);
  const byDate = {};
  visible.forEach((s) => { (byDate[s.date] ||= []).push(s); });

  return (
    <>
      <h1>Manage shifts</h1>
      <p className="muted">Add, edit, reassign or swap shifts directly. Members are notified of every change, and manual swaps appear in Approvals.</p>

      <AddShifts users={users} onCreated={load} />
      <ManualSwap shifts={shifts || []} onDone={load} />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Upcoming shifts</h2>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
            <option value="">All members</option>
            {users.filter((u) => u.role !== "manager").map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.username}</option>
            ))}
          </select>
        </div>
        {shifts === null && <p className="empty">Loading…</p>}
        {shifts !== null && visible.length === 0 && <p className="empty">No upcoming shifts.</p>}
        {Object.entries(byDate).map(([d, items]) => (
          <div key={d}>
            <div className="date-heading">{fmtDate(d)}</div>
            {items.map((s) =>
              editing === s.id ? (
                <EditRow key={s.id} shift={s} users={users}
                  onDone={() => { setEditing(null); load(); }}
                  onCancel={() => setEditing(null)} />
              ) : (
                <div key={s.id} className="row" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
                  <strong style={{ minWidth: 90 }}>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</strong>
                  <span className="grow">{s.users?.name || s.users?.username}</span>
                  {s.status !== "normal" && (
                    <span className={`badge ${s.status === "offered" ? "offered" : "accepted"}`}>{s.status}</span>
                  )}
                  <button className="btn small" onClick={() => setEditing(s.id)}>Edit</button>
                  <button className="btn small danger" onClick={() => removeShift(s.id)}>Delete</button>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function ManagePage() {
  return <Shell><ManageInner /></Shell>;
}
