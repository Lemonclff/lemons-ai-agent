"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Brain,
  BarChart3,
  Apple,
  Clock,
  type LucideIcon,
} from "lucide-react";

interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: BottomNavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "AI", href: "/ai-analysis", icon: Brain },
  { label: "Market", href: "/market-monitor", icon: BarChart3 },
  { label: "Nutrition", href: "/nutrition", icon: Apple },
  { label: "Schedule", href: "/schedule", icon: Clock },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40",
        "border-t border-[var(--color-border)]",
        "glass-strong"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-[var(--bottom-nav-height)] max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
                "transition-colors duration-200 pressable",
                "min-w-0 touch-target",
                isActive
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] active:text-[var(--color-text-secondary)]"
              )}
            >
              {/* Active top pill indicator */}
              <span
                className={cn(
                  "absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-[var(--color-accent)]",
                  "transition-all duration-300 ease-out-expo",
                  isActive ? "w-8 opacity-100 shadow-glow-sm" : "w-0 opacity-0"
                )}
              />

              <div
                className={cn(
                  "rounded-xl flex items-center justify-center transition-all duration-300 ease-out-expo",
                  isActive
                    ? "bg-[var(--color-accent-muted)] scale-105 shadow-[0_0_16px_var(--color-accent-glow)]"
                    : "scale-100"
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  className="shrink-0 m-1.5"
                />
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none truncate max-w-full px-0.5",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
