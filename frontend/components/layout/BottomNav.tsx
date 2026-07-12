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
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main navigation"
    >
      <div className="flex items-end justify-around h-[60px] max-w-lg mx-auto">
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
                "relative flex flex-col items-center justify-end gap-0.5 flex-1 h-full pb-1 transition-all duration-200",
                isActive
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              {/* Active indicator — top line */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[var(--color-accent)]" />
              )}
              <div
                className={cn(
                  "rounded-lg flex items-center justify-center transition-all duration-300",
                  isActive ? "bg-[var(--color-accent)]/10" : ""
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  className="shrink-0 m-1"
                />
              </div>
              <span className="text-[10px] font-semibold leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
