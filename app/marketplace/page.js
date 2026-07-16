"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
  });
const shiftStr = (s) => s ? `${fmtDate(s.date)} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}` : "";

function SwapPicker({ offer, myShifts, onClose, onDone }) {
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = myShifts.filter((s) => s.status === "normal");

  async function propose() {
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
      <h2>Propose your shift in return</h2>
      <p className="muted">The colleague must confirm before the swap happens.</p>
      {available.length === 0 && <p className="muted">You have no available shifts to offer in return.</p>}
      <p className="muted" style={{ margin: "10px 0 4px" }}>Tap the shift you'll give in return:</p>
      <div className="user-chips" style={{ flexDirection: "column", alignItems: "stretch" }}>
        {available.map((s) => (
          <button key={s.id}
            className={`user-chip ${chosen === s.id ? "on" : ""}`}
            style={{ textAlign: "left", padding: "10px 14px" }}
            onClick={() => setChosen(s.id)}>
            {shiftStr(s)}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={propose} disabled={!chosen || busy}>
          {busy ? "Sending…" : "Send proposal"}
        </button>
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
    setError("");
    const [a, b] = await Promise.all([fetch("/api/marketplace"), fetch("/api/shifts")]);
    const da = await a.json(); const db_ = await b.json();
    if (!a.ok) return setError(da.error || "Could not load offers");
    setOffers(da.offers || []); setMe(da.me);
    setMyShifts(db_.shifts || []);
  }
  useEffect(() => { load(); }, []);

  async function act(offer, action) {
    setError("");
    const res = await fetch(`/api/swaps/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Something went wrong");
    load();
  }

  function OfferActions({ o }) {
    const iAmPoster = o.from_user === me;
    const iAmProposer = o.to_user === me;

    if (o.status === "awaiting_confirm") {
      if (iAmPoster) {
        return (
          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              <strong>{o.proposer?.name || o.proposer?.username}</strong> offers you: {shiftStr(o.offered)}
            </div>
            <button className="btn primary" onClick={() => act(o, "confirm")}>Confirm swap</button>{" "}
            <button className="btn danger" onClick={() => act(o, "decline_proposal")}>Decline</button>
          </div>
        );
      }
      if (iAmProposer) return <span className="badge pending">Waiting for confirmation…</span>;
      return <span className="badge pending">Proposal pending</span>;
    }

    if (iAmPoster) return <span className="muted">Your offer</span>;
    if (o.type === "giveaway")
      return (
        <button className="btn primary" onClick={() => act(o, "accept")}>
          {o.portion && o.portion !== "full" ? "Take these 4 hours" : "Take this shift"}
        </button>
      );
    return <button className="btn primary" onClick={() => setPicking(o)}>Propose my shift</button>;
  }

  return (
    <Shell>
      <h1>Marketplace</h1>
      <p className="muted">
        Giveaways transfer instantly. Swaps need the poster's confirmation after you propose a shift.
      </p>
      {error && <p className="error">{error}</p>}

      {picking && (
        <SwapPicker
          offer={picking}
          myShifts={myShifts}
          onClose={() => setPicking(null)}
          onDone={() => { setPicking(null); load(); }}
        />
      )}

      {offers === null && !error && <p className="empty">Loading…</p>}
      {offers?.length === 0 && <p className="empty">No open offers right now.</p>}

      {(offers || []).some((o) => o.status === "awaiting_confirm" && o.from_user === me) && (
        <h2 style={{ marginTop: 8 }}>⚠ Needs your answer</h2>
      )}
      {(offers || [])
        .slice()
        .sort((a, b) => {
          const aNeeds = a.status === "awaiting_confirm" && a.from_user === me ? 0 : 1;
          const bNeeds = b.status === "awaiting_confirm" && b.from_user === me ? 0 : 1;
          return aNeeds - bNeeds;
        })
        .map((o) => (
        <div key={o.id}
          className={`card row ${o.status === "awaiting_confirm" && o.from_user === me ? "needs-answer" : ""}`}>
          <div className="grow">
            <span className={`badge ${o.type}`}>
              {o.type === "swap" ? "Swap" :
                o.portion === "first4" ? "Giveaway · first 4h" :
                o.portion === "last4" ? "Giveaway · last 4h" : "Giveaway"}
            </span>
            <strong style={{ marginLeft: 8 }}>{shiftStr(o.shift)}</strong>
            <div className="muted">
              from {o.poster?.name || o.poster?.username || "colleague"}{o.note ? ` — "${o.note}"` : ""}
            </div>
          </div>
          <OfferActions o={o} />
        </div>
      ))}
    </Shell>
  );
}
