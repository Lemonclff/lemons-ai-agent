"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const AUTH_PAGES = ["/login", "/register"];

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Auth pages: render children directly, no sidebar/navbar
  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // Dashboard: render normally
  return <>{children}</>;
}
