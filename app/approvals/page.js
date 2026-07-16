"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
  });
const shiftStr = (s) => s ? `${fmtDate(s.date)} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}` : "—";

function ApprovalsInner() {
  const { data: session, status } = useSession();
  const [deals, setDeals] = useState(null);
  const [filter, setFilter] = useState("todo"); // todo | done | all
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/approvals");
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Failed to load");
    setDeals(data.deals || []);
  }
  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  async function mark(id, approved) {
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
    load();
  }

  async function approveAll() {
    const todo = (deals || []).filter((d) => !d.main_approved);
    if (todo.length === 0) return;
    if (!confirm(`Mark all ${todo.length} deal(s) as approved in the MAIN program?`)) return;
    for (const d of todo) {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, approved: true }),
      });
    }
    load();
  }

  if (status === "loading") return <p className="empty">Loading…</p>;
  if (!["manager", "admin"].includes(session?.user?.role))
    return <p className="empty">This page is for Senior Service Managers and admins.</p>;

  const visible = (deals || []).filter((d) =>
    filter === "all" ? true : filter === "todo" ? !d.main_approved : d.main_approved);
  const todoCount = (deals || []).filter((d) => !d.main_approved).length;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Approvals</h1>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={filter === "todo" ? "active" : ""} onClick={() => setFilter("todo")}>
            To approve ({todoCount})
          </button>
          <button className={filter === "done" ? "active" : ""} onClick={() => setFilter("done")}>Approved</button>
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
        </div>
      </div>
      <p className="muted">
        Completed giveaways and swaps. Tick each one after you have approved it in the MAIN program.
      </p>
      {filter === "todo" && todoCount > 1 && (
        <button className="btn" style={{ marginBottom: 10 }} onClick={approveAll}>
          ✓ Mark all {todoCount} as approved
        </button>
      )}
      {error && <p className="error">{error}</p>}
      {deals === null && !error && <p className="empty">Loading…</p>}
      {deals !== null && visible.length === 0 && (
        <p className="empty">{filter === "todo" ? "Nothing waiting — all deals are approved. ✓" : "Nothing here yet."}</p>
      )}

      {visible.map((d) => (
        <div key={d.id} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="grow">
              <span className={`badge ${d.type}`}>
                {d.type === "swap" ? "Swap" :
                  d.portion === "first4" ? "Giveaway · first 4h" :
                  d.portion === "last4" ? "Giveaway · last 4h" : "Giveaway"}
              </span>
              <div style={{ marginTop: 6 }}>
                {d.type === "swap" ? (
                  <>
                    <strong>{d.poster?.name || d.poster?.username}</strong> gave {shiftStr(d.shift)}
                    {" ↔ "}
                    <strong>{d.taker?.name || d.taker?.username}</strong> gave {shiftStr(d.offered)}
                  </>
                ) : (
                  <>
                    <strong>{d.poster?.name || d.poster?.username}</strong> → {" "}
                    <strong>{d.taker?.name || d.taker?.username}</strong>: {shiftStr(d.shift)}
                  </>
                )}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                Completed {d.resolved_at ? new Date(d.resolved_at).toLocaleString() : ""}
                {d.note ? ` · note: "${d.note}"` : ""}
                {d.main_approved && d.approver ? ` · approved by ${d.approver.name || d.approver.username}` : ""}
              </div>
            </div>
            {d.main_approved ? (
              <div style={{ textAlign: "right" }}>
                <span className="badge accepted">✓ Approved in MAIN</span>
                <div><button className="btn small" style={{ marginTop: 6 }} onClick={() => mark(d.id, false)}>Undo</button></div>
              </div>
            ) : (
              <button className="btn primary" onClick={() => mark(d.id, true)}>
                Mark approved in MAIN
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export default function ApprovalsPage() {
  return <Shell><ApprovalsInner /></Shell>;
}
