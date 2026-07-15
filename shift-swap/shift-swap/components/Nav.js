"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/schedule", label: "My schedule" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/availability", label: "Availability" },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/schedule" className="brand"><span className="dot" />Shift Swap</Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`link ${pathname === l.href ? "active" : ""}`}>
            {l.label}
          </Link>
        ))}
        {session?.user?.role === "admin" && (
          <Link href="/admin" className={`link ${pathname === "/admin" ? "active" : ""}`}>Admin</Link>
        )}
        <span className="spacer" />
        <span className="muted">{session?.user?.name}</span>
        <button className="signout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
      </div>
    </nav>
  );
}
