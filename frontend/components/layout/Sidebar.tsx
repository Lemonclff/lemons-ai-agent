"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sun,
  Moon,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Schedule & Automation", href: "/schedule", icon: Clock },
  { label: "Observability", href: "/observability", icon: Activity, badge: "Langfuse" },
];

const bottomNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [_dark, _setDark] = useState(true);

  const toggleDark = () => {
    const html = document.documentElement;
    const isDark = html.classList.contains("light");
    if (isDark) {
      html.classList.remove("light");
    } else {
      html.classList.add("light");
    }
    _setDark(!isDark);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-300",
        collapsed ? "w-[64px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-[var(--color-border)]",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
          <Terminal size={16} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold gradient-text">NexusQuant</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNav.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
                collapsed && "justify-center px-0"
              )}
            >
              <item.icon size={20} />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-indigo-500/20 text-indigo-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-[var(--color-border)] space-y-1">
        {bottomNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
              collapsed && "justify-center px-0"
            )}
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* Dark/Light toggle */}
        <button
          onClick={toggleDark}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
            collapsed && "justify-center px-0"
          )}
        >
          <Sun size={20} className="block dark:hidden" />
          <Moon size={20} className="hidden dark:block" />
          {!collapsed && <span>Toggle Theme</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
