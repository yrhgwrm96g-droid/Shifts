"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginInner() {
  const params = useSearchParams();
  const error = params.get("error");
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Shift Swap</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Give away and swap shifts with your colleagues.
        </p>
        {error === "NotWhitelisted" && (
          <p className="error">
            Your account is not registered on this platform. Ask your administrator to add your email.
          </p>
        )}
        {error && error !== "NotWhitelisted" && (
          <p className="error">Sign-in failed. Please try again.</p>
        )}
        <button
          className="btn primary"
          style={{ width: "100%" }}
          onClick={() => signIn("azure-ad", { callbackUrl: "/schedule" })}
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  return <Suspense><LoginInner /></Suspense>;
}
