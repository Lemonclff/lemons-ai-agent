"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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
  TrendingUp,
  Calendar,
  HardDrive,
  X,
  ShieldCheck,
  Brain,
  Wallet,
  Mic,
  CalendarDays,
  BarChart3,
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
  { label: "AI 資產分析", href: "/ai-analysis", icon: Brain, badge: "LLM" },
  { label: "Market Monitor", href: "/market-monitor", icon: BarChart3, badge: "FRED" },
  { label: "Quant Analysis", href: "/quant-analysis", icon: TrendingUp, badge: "AI" },
  { label: "Options & Volatility", href: "/options-volatility", icon: TrendingUp, badge: "New" },
  { label: "Macro Impact Matrix", href: "/macro-impact", icon: Calendar, badge: "AI" },
  { label: "AI 智慧理財", href: "/finance", icon: Wallet, badge: "New" },
  { label: "語音轉文字", href: "/transcribe", icon: Mic, badge: "STT" },
  { label: "智能排更", href: "/roster", icon: CalendarDays, badge: "New" },
  { label: "Database Explorer", href: "/data", icon: HardDrive, badge: "DB" },
];

const bottomNav: NavItem[] = [
  { label: "Admin — Reset Password", href: "/admin/reset-password", icon: ShieldCheck },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [_dark, _setDark] = useState(true);

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose();
  }, [pathname]);

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

  const sidebarContent = (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-300",
        collapsed ? "w-[64px]" : "w-[260px]",
        // Mobile: full-width overlay
        "max-md:w-[280px] max-md:shadow-2xl"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-[var(--color-border)]",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0">
          <Terminal size={16} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold gradient-text">Lemon's AI Agent</span>
        )}
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden ml-auto p-2 rounded-lg hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"
        >
          <X size={18} />
        </button>
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
          <Sun size={20} className="dark:hidden" />
          <Moon size={20} className="hidden dark:block" />
          {!collapsed && <span>Toggle Theme</span>}
        </button>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 max-md:hidden",
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

  // Desktop: always visible; Mobile: overlay when open
  return (
    <>
      {/* Desktop sidebar */}
      <div className="max-md:hidden">{sidebarContent}</div>
      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="md:hidden">{sidebarContent}</div>
        </>
      )}
    </>
  );
}
