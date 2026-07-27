"use client";

import { PieChart, Search, Camera, TrendingUp, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "dashboard", label: "Home", icon: PieChart, active: "text-sky-400" },
  { key: "search", label: "In", icon: Search, active: "text-orange-400" },
  { key: "calories-out", label: "Out", icon: TrendingUp, active: "text-green-400" },
  { key: "photo", label: "Photo", icon: Camera, active: "text-purple-400" },
  { key: "history", label: "Hist", icon: History, active: "text-amber-400" },
  { key: "profile", label: "Me", icon: Settings, active: "text-indigo-400" },
];

export function BottomNav({ page, setPage }: { page: string; setPage: (p: string) => void }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 nutri-bottom-nav"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch justify-around h-[64px] max-w-[480px] mx-auto px-1">
        {NAV_ITEMS.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-300 min-w-0 relative pressable",
                active ? item.active : "text-[var(--color-text-muted)]"
              )}
              style={{
                transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {/* Active indicator bar — spring animated */}
              <span
                className={cn(
                  "absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300",
                  active
                    ? "w-7 opacity-100 bg-current shadow-[0_0_10px_currentColor]"
                    : "w-0 opacity-0"
                )}
                style={{
                  transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              />
              {/* Icon container with active glow */}
              <div
                className={cn(
                  "rounded-xl flex items-center justify-center transition-all duration-300",
                  active && "scale-110"
                )}
                style={{
                  transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                  backgroundColor: active
                    ? "color-mix(in srgb, currentColor 12%, transparent)"
                    : undefined,
                }}
              >
                <item.icon size={22} strokeWidth={active ? 2.5 : 1.75} className="m-1" />
              </div>
              <span className={cn("text-[11px] leading-none", active ? "font-bold" : "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
