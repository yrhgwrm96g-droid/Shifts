"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

const DAYS_AHEAD = 28;
const fmtShort = (d) =>
  d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export default function AvailabilityPage() {
  const [rows, setRows] = useState(null);
  const [me, setMe] = useState(null);

  async function load() {
    const res = await fetch("/api/availability");
    const data = await res.json();
    setRows(data.availability || []);
    setMe(data.me);
  }
  useEffect(() => { load(); }, []);

  const mine = {};
  const others = {};
  (rows || []).forEach((r) => {
    if (r.user_id === me) mine[r.date] = r.preference;
    else (others[r.date] ||= []).push(r);
  });

  async function cycle(dateStr) {
    const current = mine[dateStr];
    const next =
      !current ? "want_to_work" : current === "want_to_work" ? "prefer_off" : "clear";
    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateStr, preference: next }),
    });
    load();
  }

  const days = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    days.push(d);
  }

  return (
    <Shell>
      <h1>Availability</h1>
      <p className="muted">
        Tap a day to cycle: <span className="badge want">Want to work</span> →{" "}
        <span className="badge off">Prefer off</span> → clear. Your colleagues see this and can
        target their swap offers.
      </p>

      <h2 style={{ marginTop: 24 }}>My next {DAYS_AHEAD} days</h2>
      <div className="avail-grid">
        {days.map((d) => {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const pref = mine[key];
          const cls = pref === "want_to_work" ? "want" : pref === "prefer_off" ? "off" : "";
          return (
            <button key={key} className={`avail-day ${cls}`} onClick={() => cycle(key)}>
              <div><strong>{fmtShort(d)}</strong></div>
              <div className="muted">
                {pref === "want_to_work" ? "Want to work" : pref === "prefer_off" ? "Prefer off" : "—"}
              </div>
            </button>
          );
        })}
      </div>

      <h2 style={{ marginTop: 32 }}>Colleagues</h2>
      {rows === null && <p className="empty">Loading…</p>}
      {rows !== null && Object.keys(others).length === 0 && (
        <p className="empty">No colleagues have marked their availability yet.</p>
      )}
      {Object.entries(others).sort().map(([date, list]) => (
        <div key={date} className="card row">
          <strong className="grow">
            {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long", day: "numeric", month: "long",
            })}
          </strong>
          <div>
            {list.map((r, i) => (
              <span key={i} className={`badge ${r.preference === "want_to_work" ? "want" : "off"}`} style={{ marginLeft: 6 }}>
                {r.users?.name}: {r.preference === "want_to_work" ? "wants to work" : "prefers off"}
              </span>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  );
}
