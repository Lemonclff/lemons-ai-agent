"use client";

import { PieChart, Search, Camera, TrendingUp, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "dashboard", label: "Home", icon: PieChart },
  { key: "search",    label: "In",   icon: Search },
  { key: "calories-out", label: "Out", icon: TrendingUp },
  { key: "photo",     label: "Photo", icon: Camera },
  { key: "history",   label: "Hist",  icon: History },
  { key: "profile",   label: "Me",    icon: Settings },
];

export function BottomNav({ page, setPage }: { page: string; setPage: (p: string) => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] border-t border-[var(--color-border)] safe-area-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-around h-[80px] max-w-[480px] mx-auto px-1">
        {NAV_ITEMS.map(item => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all duration-200 min-w-0 relative",
                active
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              {/* Active indicator dot */}
              {active && (
                <span className="absolute top-2 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              )}
              <item.icon size={24} strokeWidth={active ? 2.5 : 1.75} />
              <span className="text-[12px] font-semibold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
