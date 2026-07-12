"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AmbientBackground, PageTransition } from "@/components/ui/effects";
import { cn } from "@/lib/utils";

const AUTH_PAGES = ["/login", "/register"];
const STANDALONE_MOBILE = ["/nutrition"]; // fullscreen on mobile, normal on desktop

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const isStandaloneMobile = STANDALONE_MOBILE.some(p => pathname.startsWith(p));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <>
      <AmbientBackground />
      {/* Sidebar — always on desktop, hidden on mobile for standalone pages */}
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main
        id="main-content"
        className={cn(
          "relative z-[2] min-h-dvh flex flex-col pt-safe",
          isStandaloneMobile
            ? "max-md:ml-0 max-md:pb-0"  // fullscreen on mobile
            : "ml-[260px] max-md:ml-0 max-md:pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))]"
        )}
      >
        {/* Navbar — hidden on mobile for standalone pages */}
        <div className={isStandaloneMobile ? "max-md:hidden" : ""}>
          <Navbar onMenuClick={() => setMobileOpen(true)} />
        </div>
        <div className={cn(
          "flex-1 w-full",
          isStandaloneMobile ? "max-md:p-0" : "p-4 sm:p-5 md:p-6 max-w-7xl mx-auto"
        )}>
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      {/* BottomNav — hidden on standalone pages (they have their own mobile nav) */}
      <div className={isStandaloneMobile ? "max-md:hidden" : ""}>
        <BottomNav />
      </div>
    </>
  );
}
