"use client";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault?.();
    setBusy(true); setError("");
    const res = await signIn("credentials", {
      username, password, redirect: false,
    });
    setBusy(false);
    if (res?.error) return setError("Wrong username or password.");
    router.push("/schedule");
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Shift Swap</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Give away and swap shifts with your colleagues.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          <label className="field">Username
            <input value={username} autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </label>
          <label className="field">Password
            <input type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" style={{ width: "100%", marginTop: 16 }}
          onClick={submit} disabled={busy || !username || !password}>
          Sign in
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          No account? Your administrator creates accounts.
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return <Suspense><LoginInner /></Suspense>;
}
