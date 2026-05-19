"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard" }];

  return [
    { label: "Home", href: "/" },
    ...segments.map((seg, i) => ({
      label: seg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      href: i < segments.length - 1 ? `/${segments.slice(0, i + 1).join("/")}` : undefined,
    })),
  ];
}

export function Navbar() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight
                size={14}
                className="text-[var(--color-text-muted)]"
              />
            )}
            {crumb.href ? (
              <a
                href={crumb.href}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {crumb.label}
              </a>
            ) : (
              <span className="text-[var(--color-text-primary)] font-medium">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Search */}
        <button
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm rounded-xl",
            "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]",
            "hover:text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)]",
            "transition-all duration-200"
          )}
        >
          <Search size={16} />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className={cn(
            "relative p-2 rounded-xl text-[var(--color-text-muted)]",
            "hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]",
            "transition-all duration-200"
          )}
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
        </button>
      </div>
    </header>
  );
}
