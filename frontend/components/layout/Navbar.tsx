"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, ChevronRight, LogOut, Menu, Sun, Moon, UserCircle, Shield, Crown } from "lucide-react";
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
  const { theme, toggleTheme } = useTheme();
  const breadcrumbs = getBreadcrumbs(pathname);
  const [user, setUser] = useState<{ username: string; isAdmin: boolean; userId: number } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { if (d.username) setUser(d); })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // color palette for avatar based on username
  const avatarColors = ["bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500"];
  const colorIdx = user ? user.username.charCodeAt(0) % avatarColors.length : 0;

  return (
    <header
      className="sticky z-30 flex items-center h-16 px-4 md:px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl gap-2"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-xl hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"
      >
        <Menu size={20} />
      </button>

      <nav className="flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0" />}
            {crumb.href ? (
              <a href={crumb.href} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
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

      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        <button className={cn(
          "flex items-center gap-2 px-3 md:px-4 py-2 text-sm rounded-xl",
          "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]",
          "hover:text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)]",
          "transition-all duration-200"
        )}>
          <Search size={16} />
          <span className="hidden sm:inline">Search...</span>
        </button>

        <button className={cn(
          "relative p-2 rounded-xl text-[var(--color-text-muted)]",
          "hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]",
          "transition-all duration-200"
        )}>
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
        </button>

        <button onClick={toggleTheme} className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-all duration-200"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button onClick={handleLogout} className={cn("p-2 rounded-xl text-[var(--color-text-muted)]", "hover:text-red-400 hover:bg-red-500/10", "transition-all duration-200")} title="登出">
          <LogOut size={18} />
        </button>

        {/* ── User Display ── */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]/50">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm", avatarColors[colorIdx])}>
              {user.isAdmin ? <Crown size={14} /> : user.username.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">{user.username}</div>
              {user.isAdmin && (
                <div className="text-[10px] text-amber-400/80 flex items-center gap-0.5">
                  <Shield size={10} /> Admin
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]/50">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
              <UserCircle size={16} className="text-[var(--color-text-muted)]" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
