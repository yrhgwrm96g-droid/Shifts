"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
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

function Bell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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
    const t = setInterval(load, 60000); // refresh every minute
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
        {role === "admin" && (
          <Link href="/admin" className={`link ${pathname === "/admin" ? "active" : ""}`}>Admin</Link>
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
