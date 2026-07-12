"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Search,
  ChevronRight,
  LogOut,
  Menu,
  Sun,
  Moon,
  UserCircle,
  Shield,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";

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
      href:
        i < segments.length - 1
          ? `/${segments.slice(0, i + 1).join("/")}`
          : undefined,
    })),
  ];
}

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const breadcrumbs = getBreadcrumbs(pathname);
  const [user, setUser] = useState<{
    username: string;
    isAdmin: boolean;
    userId: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.username) setUser(d);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const avatarColors = [
    "bg-sky-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-fuchsia-500",
  ];
  const colorIdx = user
    ? user.username.charCodeAt(0) % avatarColors.length
    : 0;

  return (
    <header
      className={cn(
        "sticky top-safe z-30 flex items-center h-14 sm:h-16 px-3 sm:px-4 md:px-6 gap-1.5 sm:gap-2",
        "border-b border-[var(--color-border)]",
        "glass-strong"
      )}
    >
      <button
        onClick={onMenuClick}
        className="md:hidden p-2.5 rounded-xl hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] touch-target pressable"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <nav
        className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none whitespace-nowrap min-w-0 flex-1"
        aria-label="Breadcrumb"
      >
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight
                size={14}
                className="text-[var(--color-text-muted)] shrink-0 opacity-60"
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
              <span className="text-[var(--color-text-primary)] font-semibold truncate max-w-[140px] sm:max-w-[220px] md:max-w-none">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        <button
          className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-2 text-sm rounded-xl",
            "bg-[var(--color-surface-elevated)]/80 text-[var(--color-text-muted)]",
            "hover:text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)]",
            "transition-all duration-200"
          )}
          aria-label="Search"
        >
          <Search size={16} />
          <span className="hidden md:inline">Search...</span>
          <kbd className="hidden lg:inline ml-2 px-1.5 py-0.5 text-[10px] rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
            ⌘K
          </kbd>
        </button>

        <button
          className={cn(
            "relative p-2.5 rounded-xl text-[var(--color-text-muted)]",
            "hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]",
            "transition-all duration-200 touch-target pressable"
          )}
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-all duration-200 touch-target pressable"
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={handleLogout}
          className={cn(
            "p-2.5 rounded-xl text-[var(--color-text-muted)]",
            "hover:text-red-400 hover:bg-red-500/10",
            "transition-all duration-200 touch-target pressable"
          )}
          title="登出"
          aria-label="Logout"
        >
          <LogOut size={18} />
        </button>

        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-[var(--color-border)]",
                avatarColors[colorIdx]
              )}
            >
              {user.isAdmin ? (
                <Crown size={14} />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                {user.username}
              </div>
              {user.isAdmin && (
                <div className="text-[10px] text-amber-400/90 flex items-center gap-0.5">
                  <Shield size={10} /> Admin
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
              <UserCircle
                size={16}
                className="text-[var(--color-text-muted)]"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
