"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Clock,
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
  Apple,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

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
  { label: "Nutrition", href: "/nutrition", icon: Apple, badge: "New" },
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

function SidebarInner({
  collapsed,
  setCollapsed,
  onMobileClose,
  isMobile,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onMobileClose: () => void;
  isMobile?: boolean;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-dvh flex flex-col",
        "border-r border-[var(--color-border)]",
        "bg-[var(--color-surface)]/95 backdrop-blur-xl",
        "transition-[width] duration-300 ease-out-expo",
        collapsed && !isMobile ? "w-[64px]" : "w-[260px]",
        isMobile && "w-[min(280px,85vw)] shadow-xl animate-[slide-from-left_0.28s_var(--ease-out-expo)]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-[var(--color-border)] shrink-0",
          collapsed && !isMobile ? "justify-center" : "gap-3"
        )}
      >
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0 shadow-glow-sm">
          <Terminal size={16} className="text-white relative z-10" />
          <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
        </div>
        {(!collapsed || isMobile) && (
          <span className="text-base font-bold gradient-text truncate">
            Lemon&apos;s AI
          </span>
        )}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-2.5 rounded-xl hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] touch-target pressable"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto scrollbar-none overscroll-contain">
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
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                "transition-all duration-200 group min-h-[44px]",
                isActive
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)] nav-active-glow"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] active:scale-[0.98]",
                collapsed && !isMobile && "justify-center px-0"
              )}
              title={collapsed && !isMobile ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--color-accent)] shadow-glow-sm" />
              )}
              <item.icon
                size={20}
                strokeWidth={isActive ? 2.25 : 1.75}
                className="shrink-0"
              />
              {(!collapsed || isMobile) && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] font-semibold rounded-md shrink-0",
                        isActive
                          ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                          : "bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2.5 py-3 border-t border-[var(--color-border)] space-y-0.5 shrink-0">
        {bottomNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
              "transition-all duration-200",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
              collapsed && !isMobile && "justify-center px-0"
            )}
            title={collapsed && !isMobile ? item.label : undefined}
          >
            <item.icon size={20} className="shrink-0" />
            {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
          </Link>
        ))}

        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
            "transition-all duration-200",
            "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
            collapsed && !isMobile && "justify-center px-0"
          )}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          {(!collapsed || isMobile) && (
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          )}
        </button>

        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px]",
              "transition-all duration-200",
              "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
              collapsed && "justify-center px-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    onMobileClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <div className="max-md:hidden">
        <SidebarInner
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onMobileClose={onMobileClose}
        />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/55 backdrop-blur-sm animate-[fadeIn_180ms_ease]"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="md:hidden">
            <SidebarInner
              collapsed={false}
              setCollapsed={setCollapsed}
              onMobileClose={onMobileClose}
              isMobile
            />
          </div>
        </>
      )}
    </>
  );
}
