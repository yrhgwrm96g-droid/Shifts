"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);

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
    setOk(`Account "${form.username}" created. Give them the username and temporary password — they will set their own on first login.`);
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
        <p className="muted">Give the colleague their username and temporary password. They set their own password on first login.</p>
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
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="btn primary" onClick={add}
            disabled={!form.username || !form.temp_password}>Create</button>
        </div>
        {error && <p className="error">{error}</p>}
        {ok && <p style={{ color: "var(--green)" }}>{ok}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Password</th><th></th></tr></thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.name || "—"}</td>
                <td>{u.role}</td>
                <td>{u.must_change_password ? "Temporary (not set yet)" : "Set by user"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn" onClick={() => resetPassword(u.id, u.username)}>Reset password</button>{" "}
                  <button className="btn danger" onClick={() => remove(u.id)}>Remove</button>
                </td>
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
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
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
                <td>{s.users?.name || s.users?.username}</td>
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
