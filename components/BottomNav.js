"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const items = [
    { href: "/schedule", label: "Schedule", icon: "📅" },
    { href: "/marketplace", label: "Market", icon: "🔁" },
  ];
  if (role === "user" || !role) items.push({ href: "/availability", label: "Days", icon: "🙋" });
  if (role === "manager" || role === "admin") {
    items.push({ href: "/approvals", label: "Approve", icon: "✅" });
    items.push({ href: "/admin", label: "Manage", icon: "🛠️" });
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
