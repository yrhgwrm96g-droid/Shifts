"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });

function OfferDialog({ shift, onClose, onDone }) {
  const [type, setType] = useState("giveaway");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError("");
    const res = await fetch(`/api/shifts/${shift.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "offer", type, note }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    onDone();
  }

  return (
    <div className="card" style={{ borderColor: "var(--green)" }}>
      <h2>Offer this shift</h2>
      <p className="muted">{fmtDate(shift.date)} · {fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}</p>
      <div className="row" style={{ margin: "12px 0" }}>
        <label className="field grow">
          Offer type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="giveaway">Giveaway — someone takes it, nothing in return</option>
            <option value="swap">Swap — someone gives me one of their shifts</option>
          </select>
        </label>
        <label className="field grow">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. doctor appointment" />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary" onClick={submit} disabled={busy}>Post offer</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const [shifts, setShifts] = useState(null);
  const [teamShifts, setTeamShifts] = useState(null);
  const [showTeam, setShowTeam] = useState(false);
  const [offering, setOffering] = useState(null);

  async function load() {
    const res = await fetch("/api/shifts");
    const data = await res.json();
    setShifts(data.shifts || []);
  }
  async function loadTeam() {
    const res = await fetch("/api/shifts?all=1");
    const data = await res.json();
    setTeamShifts(data.shifts || []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (showTeam && !teamShifts) loadTeam(); }, [showTeam]);

  async function cancelOffer(id) {
    await fetch(`/api/shifts/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_offer" }),
    });
    load();
  }

  const list = showTeam ? teamShifts : shifts;
  const byDate = {};
  (list || []).forEach((s) => { (byDate[s.date] ||= []).push(s); });

  return (
    <Shell>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{showTeam ? "Team schedule" : "My schedule"}</h1>
        <button className="btn" onClick={() => setShowTeam(!showTeam)}>
          {showTeam ? "Show my shifts" : "Show whole team"}
        </button>
      </div>

      {offering && (
        <OfferDialog
          shift={offering}
          onClose={() => setOffering(null)}
          onDone={() => { setOffering(null); load(); }}
        />
      )}

      {list === null && <p className="empty">Loading…</p>}
      {list?.length === 0 && (
        <p className="empty">No upcoming shifts yet. Your administrator adds schedules.</p>
      )}

      {Object.entries(byDate).map(([date, items]) => (
        <div key={date}>
          <div className="date-heading">{fmtDate(date)}</div>
          {items.map((s) => (
            <div key={s.id} className="card row">
              <div className="grow">
                <strong>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</strong>
                {showTeam && <span className="muted"> · {s.users?.name || s.users?.email}</span>}
                {s.status === "offered" && <span className="badge offered" style={{ marginLeft: 8 }}>Offered</span>}
              </div>
              {!showTeam && s.status === "normal" && (
                <button className="btn" onClick={() => setOffering(s)}>Offer for giveaway / swap</button>
              )}
              {!showTeam && s.status === "offered" && (
                <button className="btn danger" onClick={() => cancelOffer(s.id)}>Cancel offer</button>
              )}
            </div>
          ))}
        </div>
      ))}
    </Shell>
  );
}
