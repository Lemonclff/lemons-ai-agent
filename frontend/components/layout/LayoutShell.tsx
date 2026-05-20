"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

const AUTH_PAGES = ["/login", "/register"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className="ml-[260px] min-h-screen flex flex-col max-md:ml-0">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <div className="flex-1 p-6 max-md:p-4">{children}</div>
      </main>
    </>
  );
}
