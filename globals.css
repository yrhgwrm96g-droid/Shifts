"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Shell from "@/components/Shell";

function ChangePasswordInner() {
  const router = useRouter();
  const { update } = useSession();
  const [current, setCurrent] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (pw1.length < 8) return setError("New password must be at least 8 characters.");
    if (pw1 !== pw2) return setError("New passwords do not match.");
    setBusy(true);
    const res = await fetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: pw1 }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    await update(); // refresh session so mustChange flag clears
    router.push("/schedule");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1>Set a new password</h1>
      <p className="muted">
        Choose your own password (at least 8 characters). You'll use it for all future sign-ins.
      </p>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <label className="field">Current (temporary) password
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="field">New password
          <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="field">Repeat new password
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" onClick={submit} disabled={busy || !current || !pw1 || !pw2}>
          Save new password
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return <Shell noRedirect><ChangePasswordInner /></Shell>;
}
