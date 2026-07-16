"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const linksByRole = (role) =>
  role === "manager"
    ? [
        { href: "/schedule", label: "Team schedule" },
        { href: "/marketplace", label: "Marketplace" },
      ]
    : [
        { href: "/schedule", label: "Schedule" },
        { href: "/marketplace", label: "Marketplace" },
        { href: "/availability", label: "Availability" },
      ];

function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "dark");
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  }
  return (
    <button className="signout" onClick={toggle} title="Switch light/dark mode" aria-label="Switch theme">
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

function usePush() {
  const [state, setState] = useState("checking"); // checking|unsupported|off|on|denied
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (Notification.permission === "denied") return setState("denied");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch { setState("unsupported"); }
    })();
  }, []);

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState("on");
    } catch { setState("unsupported"); }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {}
  }
  return { state, enable, disable };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function Bell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const push = usePush();

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {}
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
    }
  }

  return (
    <span className="bell-wrap" ref={ref}>
      <button className="signout bell-btn" onClick={toggleOpen} aria-label="Notifications">
        🔔{unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          <div className="bell-title">Notifications</div>
          {push.state === "off" && (
            <div className="bell-item">
              <button className="btn small primary" style={{ width: "100%" }} onClick={push.enable}>
                🔔 Enable phone notifications
              </button>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Get a notification on this device when your shift is taken, swapped or approved.
              </div>
            </div>
          )}
          {push.state === "on" && (
            <div className="bell-item row" style={{ justifyContent: "space-between" }}>
              <span className="muted" style={{ fontSize: 12 }}>Phone notifications: on ✓</span>
              <button className="btn small" onClick={push.disable}>Turn off</button>
            </div>
          )}
          {push.state === "denied" && (
            <div className="bell-item muted" style={{ fontSize: 12 }}>
              Notifications are blocked for this site in your device settings.
            </div>
          )}
          {items.length === 0 && <div className="muted" style={{ padding: "12px" }}>Nothing yet.</div>}
          {items.map((n) => (
            <div key={n.id} className={`bell-item ${n.read ? "" : "unread"}`}>
              <div>{n.message}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const links = linksByRole(role);
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/schedule" className="brand"><span className="dot" />Shift Swap</Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`link ${pathname === l.href ? "active" : ""}`}>
            {l.label}
          </Link>
        ))}
        {(role === "manager" || role === "admin") && (
          <Link href="/approvals" className={`link ${pathname === "/approvals" ? "active" : ""}`}>Approvals</Link>
        )}
        {(role === "manager" || role === "admin") && (
          <Link href="/admin" className={`link ${pathname === "/admin" ? "active" : ""}`}>
            {role === "admin" ? "Admin" : "Manage"}
          </Link>
        )}
        <span className="spacer" />
        <Bell />
        <ThemeToggle />
        <span className="muted nav-name">{session?.user?.name}</span>
        <button className="signout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
      </div>
    </nav>
  );
}
