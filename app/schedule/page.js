"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

const fmtTime = (t) => t?.slice(0, 5);
const iso = (d) => d.toISOString().slice(0, 10);
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });

const shiftKind = (start) => {
  const h = parseInt(start.slice(0, 2));
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 20) return "afternoon";
  return "night";
};
const KIND_LABEL = { morning: "Morning", afternoon: "Afternoon", night: "Night" };

function OfferDialog({ shift, onClose, onDone }) {
  const [type, setType] = useState("giveaway");
  const [portion, setPortion] = useState("full");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError("");
    const res = await fetch(`/api/shifts/${shift.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "offer", type, portion: type === "giveaway" ? portion : "full", note }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    onDone();
  }
  async function cancelOffer() {
    setBusy(true);
    await fetch(`/api/shifts/${shift.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_offer" }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="card" style={{ borderColor: "var(--green)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>
          {fmtDate(shift.date)} · {fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}
        </h2>
        <button className="btn" onClick={onClose}>✕ Close</button>
      </div>

      {shift.status === "offered" ? (
        <>
          <p className="muted" style={{ margin: "10px 0" }}>
            This shift is currently offered on the marketplace.
          </p>
          <button className="btn danger" onClick={cancelOffer} disabled={busy}>Cancel my offer</button>
        </>
      ) : (
        <>
          <div className="row" style={{ margin: "12px 0" }}>
            <label className="field grow">
              Offer type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="giveaway">Giveaway — someone takes it, nothing in return</option>
                <option value="swap">Swap — someone gives me one of their shifts</option>
              </select>
            </label>
            {type === "giveaway" && (
              <label className="field grow">
                How much
                <select value={portion} onChange={(e) => setPortion(e.target.value)}>
                  <option value="full">Whole shift</option>
                  <option value="first4">First 4 hours only</option>
                  <option value="last4">Last 4 hours only</option>
                </select>
              </label>
            )}
            <label className="field grow">
              Note (optional)
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. doctor appointment" />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" onClick={submit} disabled={busy}>Post offer</button>
        </>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [shifts, setShifts] = useState(null);
  const [me, setMe] = useState(null);
  const [showTeam, setShowTeam] = useState(false);
  const [selected, setSelected] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [kindFilter, setKindFilter] = useState("all");   // all | morning | afternoon | night
  const [personFilter, setPersonFilter] = useState("");  // user_id or ""

  // Calendar grid: starts Monday on/before the 1st, ends Sunday on/after the last day
  const gridStart = new Date(month);
  gridStart.setDate(1 - ((month.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  const gridEnd = cells[41];

  async function load() {
    const url = `/api/shifts?from=${iso(gridStart)}&to=${iso(gridEnd)}${showTeam ? "&all=1" : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    setShifts(data.shifts || []);
    setMe(data.me);
  }
  useEffect(() => { setShifts(null); load(); }, [month, showTeam]);

  const filtered = (shifts || []).filter((s) => {
    if (!showTeam) return true;
    if (kindFilter !== "all" && shiftKind(s.start_time) !== kindFilter) return false;
    if (personFilter && s.user_id !== personFilter) return false;
    return true;
  });
  const byDate = {};
  filtered.forEach((s) => { (byDate[s.date] ||= []).push(s); });

  const people = [];
  const seen = new Set();
  (shifts || []).forEach((s) => {
    if (!seen.has(s.user_id)) {
      seen.add(s.user_id);
      people.push({ id: s.user_id, label: s.users?.name || s.users?.username || "?" });
    }
  });
  people.sort((a, b) => a.label.localeCompare(b.label));

  // My total hours in the displayed month
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-`;
  const myHours = (shifts || [])
    .filter((s) => s.user_id === me && s.date.startsWith(monthPrefix))
    .reduce((sum, s) => {
      const start = parseInt(s.start_time.slice(0, 2)) * 60 + parseInt(s.start_time.slice(3, 5));
      let end = parseInt(s.end_time.slice(0, 2)) * 60 + parseInt(s.end_time.slice(3, 5));
      if (end <= start) end += 1440;
      return sum + (end - start) / 60;
    }, 0);

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayIso = iso(new Date());

  return (
    <Shell>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{showTeam ? "Team schedule" : "My schedule"}</h1>
        <div className="row">
          <span className="hours-pill" title="Your total scheduled hours this month">
            {Math.round(myHours * 10) / 10} h this month
          </span>
          <button className="btn" onClick={() => setShowTeam(!showTeam)}>
            {showTeam ? "My shifts" : "Whole team"}
          </button>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>← Prev</button>
        <h2 style={{ margin: 0 }}>{monthLabel}</h2>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next →</button>
      </div>

      {dayDetail && byDate[dayDetail] && (
        <div className="card" style={{ borderColor: "var(--green)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{fmtDate(dayDetail)}</h2>
            <button className="btn small" onClick={() => setDayDetail(null)}>✕ Close</button>
          </div>
          <div className="day-detail-list">
            {byDate[dayDetail]
              .slice()
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((s) => {
                const kind = shiftKind(s.start_time);
                return (
                  <div key={s.id} className="row" style={{ gap: 8 }}>
                    <span className={`shift-chip ${kind}`} style={{ cursor: "default" }}>
                      {KIND_LABEL[kind]} {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                    </span>
                    <span>{s.users?.name || s.users?.username}{s.user_id === me ? " (you)" : ""}</span>
                    {s.status === "offered" && <span className="badge offered">offered</span>}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {selected && (
        <OfferDialog
          shift={selected}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); load(); }}
        />
      )}

      {showTeam && (
        <div className="filter-bar">
          {[["all", "All shifts"], ["morning", "Morning 07–15"], ["afternoon", "Afternoon 15–23"], ["night", "Night 23–07"]].map(([k, label]) => (
            <button key={k}
              className={`user-chip ${kindFilter === k ? "on" : ""}`}
              onClick={() => setKindFilter(k)}>{label}</button>
          ))}
          <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value="">Everyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
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
              onClick={() => { if (showTeam && dayShifts.length > 0) setDayDetail(key); }}
              style={showTeam && dayShifts.length > 0 ? { cursor: "pointer" } : undefined}>
              <div className="cal-daynum">{d.getDate()}</div>
              {dayShifts.map((s) => {
                const kind = shiftKind(s.start_time);
                const isMine = s.user_id === me;
                return (
                  <button
                    key={s.id}
                    className={`shift-chip ${kind} ${s.status === "offered" ? "is-offered" : ""} ${isMine && !showTeam ? "clickable" : ""}`}
                    onClick={(e) => { if (isMine && !showTeam) { e.stopPropagation(); setSelected(s); } }}
                    title={`${KIND_LABEL[kind]} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}${s.status === "offered" ? " (offered)" : ""}`}>
                    {showTeam
                      ? <>{(s.users?.name || s.users?.username || "").split(" ")[0]} <span className="chip-time">{fmtTime(s.start_time)}</span></>
                      : <>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</>}
                    {s.status === "offered" && <span className="chip-flag">!</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 16 }}>
        <span className="legend"><span className="dot-sample morning" /> Morning 07–15</span>
        <span className="legend"><span className="dot-sample afternoon" /> Afternoon 15–23</span>
        <span className="legend"><span className="dot-sample night" /> Night 23–07</span>
        <span className="legend"><strong>!</strong> = offered on marketplace</span>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {showTeam
          ? "Tap a day to see exactly who is working and when."
          : "Tap one of your shifts to offer it for giveaway or swap, or to cancel an offer."}
      </p>
      {shifts !== null && shifts.length === 0 && (
        <p className="empty">No shifts this month{showTeam ? "" : " — your administrator adds schedules"}.</p>
      )}
    </Shell>
  );
}
