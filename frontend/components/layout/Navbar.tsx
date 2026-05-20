"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, ChevronRight, LogOut, Menu } from "lucide-react";
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

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumbs = getBreadcrumbs(pathname);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-4 md:px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl gap-2">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-xl hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight
                size={14}
                className="text-[var(--color-text-muted)] shrink-0"
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
              <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[120px] md:max-w-none">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        {/* Search */}
        <button
          className={cn(
            "flex items-center gap-2 px-3 md:px-4 py-2 text-sm rounded-xl",
            "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]",
            "hover:text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)]",
            "transition-all duration-200"
          )}
        >
          <Search size={16} />
          <span className="hidden sm:inline">Search...</span>
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

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            "p-2 rounded-xl text-[var(--color-text-muted)]",
            "hover:text-red-400 hover:bg-red-500/10",
            "transition-all duration-200"
          )}
          title="登出"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
