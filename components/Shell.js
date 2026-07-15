"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import Nav from "./Nav";

function Guard({ children, noRedirect }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!noRedirect && status === "authenticated" && session?.user?.mustChange &&
        pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [status, session, pathname, noRedirect, router]);

  return (
    <>
      <Nav />
      <main className="container">{children}</main>
    </>
  );
}

export default function Shell({ children, noRedirect = false }) {
  return (
    <SessionProvider>
      <Guard noRedirect={noRedirect}>{children}</Guard>
    </SessionProvider>
  );
}
