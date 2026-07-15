"use client";
import { useEffect, useState } from "react";
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
        <ThemeToggle />
        <span className="muted nav-name">{session?.user?.name}</span>
        <button className="signout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
      </div>
    </nav>
  );
}
