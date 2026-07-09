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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-end justify-around h-[var(--bottom-nav-height)] pb-[max(6px,env(safe-area-inset-bottom,0px))] border-t border-[var(--color-border)] bg-[var(--color-surface)]"
      aria-label="Main navigation"
    >
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
              "relative flex flex-col items-center justify-center gap-1 min-w-0 flex-1 pb-1.5 pt-1 transition-all duration-200",
              "min-h-[48px] min-w-[48px]",
              isActive
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {/* Active indicator — top pill */}
            {isActive && (
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--color-accent)]" />
            )}
            <div className={cn(
              "rounded-xl flex items-center justify-center transition-all duration-300",
              isActive ? "bg-[var(--color-accent)]/10" : ""
            )}>
              <Icon
                size={24}
                strokeWidth={isActive ? 2.5 : 2}
                className="shrink-0 m-1"
              />
            </div>
            <span className="text-[11px] font-semibold truncate max-w-full leading-tight">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
