"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
  });

function SwapPicker({ offer, myShifts, onClose, onDone }) {
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = myShifts.filter((s) => s.status === "normal");

  async function accept() {
    setBusy(true); setError("");
    const res = await fetch(`/api/swaps/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", offered_shift_id: chosen }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    onDone();
  }

  return (
    <div className="card" style={{ borderColor: "var(--green)" }}>
      <h2>Choose your shift to give in return</h2>
      {available.length === 0 && <p className="muted">You have no available shifts to offer in return.</p>}
      <div className="row" style={{ margin: "12px 0" }}>
        <select className="grow" value={chosen} onChange={(e) => setChosen(e.target.value)}>
          <option value="">— Select a shift —</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {fmtDate(s.date)} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary" onClick={accept} disabled={!chosen || busy}>Confirm swap</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [offers, setOffers] = useState(null);
  const [me, setMe] = useState(null);
  const [myShifts, setMyShifts] = useState([]);
  const [picking, setPicking] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const [a, b] = await Promise.all([fetch("/api/marketplace"), fetch("/api/shifts")]);
    const da = await a.json(); const db_ = await b.json();
    setOffers(da.offers || []); setMe(da.me);
    setMyShifts(db_.shifts || []);
  }
  useEffect(() => { load(); }, []);

  async function take(offer) {
    setError("");
    const res = await fetch(`/api/swaps/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Something went wrong");
    load();
  }

  return (
    <Shell>
      <h1>Marketplace</h1>
      <p className="muted">Shifts colleagues want to give away or swap. Accepting is final.</p>
      {error && <p className="error">{error}</p>}

      {picking && (
        <SwapPicker
          offer={picking}
          myShifts={myShifts}
          onClose={() => setPicking(null)}
          onDone={() => { setPicking(null); load(); }}
        />
      )}

      {offers === null && <p className="empty">Loading…</p>}
      {offers?.length === 0 && <p className="empty">No open offers right now.</p>}

      {(offers || []).map((o) => (
        <div key={o.id} className="card row">
          <div className="grow">
            <span className={`badge ${o.type}`}>{o.type === "giveaway" ? "Giveaway" : "Swap"}</span>
            <strong style={{ marginLeft: 8 }}>
              {fmtDate(o.shifts.date)} · {fmtTime(o.shifts.start_time)}–{fmtTime(o.shifts.end_time)}
            </strong>
            <div className="muted">
              from {o.users?.name || "colleague"}{o.note ? ` — “${o.note}”` : ""}
            </div>
          </div>
          {o.from_user === me ? (
            <span className="muted">Your offer</span>
          ) : o.type === "giveaway" ? (
            <button className="btn primary" onClick={() => take(o)}>Take this shift</button>
          ) : (
            <button className="btn primary" onClick={() => setPicking(o)}>Propose my shift</button>
          )}
        </div>
      ))}
    </Shell>
  );
}
