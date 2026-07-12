"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AmbientBackground, PageTransition } from "@/components/ui/effects";

const AUTH_PAGES = ["/login", "/register"];
const STANDALONE_PAGES = ["/nutrition"]; // fullscreen pages with own nav

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const isStandalone = STANDALONE_PAGES.some(p => pathname.startsWith(p));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isAuth) {
    return <>{children}</>;
  }

  // Standalone pages: no sidebar, no navbar, no bottom nav — just fullscreen content
  if (isStandalone) {
    return (
      <>
        <AmbientBackground />
        <main id="main-content" className="relative z-[2] min-h-dvh">
          {children}
        </main>
      </>
    );
  }

  return (
    <>
      <AmbientBackground />
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main
        id="main-content"
        className="relative z-[2] ml-[260px] min-h-dvh flex flex-col max-md:ml-0 max-md:pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] pt-safe"
      >
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <div className="flex-1 p-4 sm:p-5 md:p-6 max-w-7xl mx-auto w-full">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
