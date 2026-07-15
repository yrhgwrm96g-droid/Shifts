"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);

function UsersTab() {
  const [users, setUsers] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed");
    setEmail(""); load();
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
        <h2>Whitelist a new user</h2>
        <p className="muted">Only emails added here can sign in with Microsoft.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="grow" placeholder="colleague@company.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn primary" onClick={add} disabled={!email}>Add</button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Activated</th><th></th></tr></thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || "—"}</td>
                <td>{u.role}</td>
                <td>{u.activated ? "Yes" : "Not yet signed in"}</td>
                <td><button className="btn danger" onClick={() => remove(u.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ShiftsTab() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState(null);
  const [form, setForm] = useState({ user_id: "", date: "", start_time: "09:00", end_time: "17:00", repeat_until: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    const [a, b] = await Promise.all([fetch("/api/admin/users"), fetch("/api/admin/shifts")]);
    setUsers((await a.json()).users || []);
    setShifts((await b.json()).shifts || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setError(""); setOk("");
    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, repeat_until: form.repeat_until || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed");
    setOk(`Created ${data.created} shift(s)`); load();
  }
  async function remove(id) {
    await fetch("/api/admin/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="card">
        <h2>Add shifts</h2>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="field grow">User
            <select value={form.user_id} onChange={set("user_id")}>
              <option value="">— Select —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </label>
          <label className="field">Date
            <input type="date" value={form.date} onChange={set("date")} />
          </label>
          <label className="field">Start
            <input type="time" value={form.start_time} onChange={set("start_time")} />
          </label>
          <label className="field">End
            <input type="time" value={form.end_time} onChange={set("end_time")} />
          </label>
          <label className="field">Repeat weekly until (optional)
            <input type="date" value={form.repeat_until} onChange={set("repeat_until")} />
          </label>
          <button className="btn primary" onClick={add} disabled={!form.user_id || !form.date}>Add</button>
        </div>
        {error && <p className="error">{error}</p>}
        {ok && <p style={{ color: "var(--green)" }}>{ok}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>User</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(shifts || []).map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</td>
                <td>{s.users?.name || s.users?.email}</td>
                <td>{s.status}</td>
                <td><button className="btn danger" onClick={() => remove(s.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {shifts?.length === 0 && <p className="empty">No upcoming shifts.</p>}
      </div>
    </>
  );
}

function AdminInner() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState("shifts");
  if (status === "loading") return <p className="empty">Loading…</p>;
  if (session?.user?.role !== "admin")
    return <p className="empty">This page is for administrators only.</p>;
  return (
    <>
      <h1>Admin panel</h1>
      <div className="tabs">
        <button className={tab === "shifts" ? "active" : ""} onClick={() => setTab("shifts")}>Shifts</button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Users</button>
      </div>
      {tab === "shifts" ? <ShiftsTab /> : <UsersTab />}
    </>
  );
}

export default function AdminPage() {
  return <Shell><AdminInner /></Shell>;
}
