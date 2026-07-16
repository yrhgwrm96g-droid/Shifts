"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  let items;
  if (role === "manager") {
    // Seniors: no personal schedule, no availability
    items = [
      { href: "/admin", label: "Manage", icon: "🛠️" },
      { href: "/approvals", label: "Approve", icon: "✅" },
      { href: "/schedule", label: "Team", icon: "👥" },
    ];
  } else if (role === "admin") {
    items = [
      { href: "/schedule", label: "Schedule", icon: "📅" },
      { href: "/approvals", label: "Approve", icon: "✅" },
      { href: "/admin", label: "Manage", icon: "🛠️" },
    ];
  } else {
    items = [
      { href: "/schedule", label: "Schedule", icon: "📅" },
      { href: "/marketplace", label: "Market", icon: "🔁" },
      { href: "/availability", label: "Days", icon: "🙋" },
    ];
  }

  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <Link key={it.href} href={it.href}
          className={`bn-item ${pathname === it.href ? "active" : ""}`}>
          <span className="bn-icon">{it.icon}</span>
          <span className="bn-label">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
