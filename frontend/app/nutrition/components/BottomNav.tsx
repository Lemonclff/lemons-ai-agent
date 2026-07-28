"use client";

import { cn } from "@/lib/utils";

interface NavItem {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> | React.ElementType;
  color: string;
}

interface BottomNavProps {
  page: string;
  setPage: (key: string) => void;
  items: NavItem[];
}

export function BottomNav({ page, setPage, items }: BottomNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-4 left-4 right-4 z-50"
      style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Outer Shell — iOS Liquid Glass pill */}
      <div
        className="relative rounded-[2rem] p-1.5 backdrop-blur-2xl nutri-bottom-nav"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-surface) 72%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-border) 40%, transparent)",
          boxShadow:
            "0 8px 32px color-mix(in srgb, rgb(0 0 0) 12%, transparent), inset 0 1px 0 color-mix(in srgb, rgb(255 255 255) 8%, transparent)",
        }}
      >
        {/* Inner Track */}
        <div className="flex items-center justify-around h-[56px]">
          {items.map((item) => {
            const a = page === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0",
                  "rounded-2xl transition-all duration-[500ms] active:scale-[0.92]"
                )}
                style={{
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              >
                {/* Active background glow — tinted glass blob */}
                {a && (
                  <span
                    className="absolute inset-0 rounded-2xl transition-all duration-[500ms]"
                    style={{
                      backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)",
                      transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                    }}
                  />
                )}

                {/* Icon container — Double-Bezel nested core */}
                <div
                  className={cn(
                    "rounded-xl flex items-center justify-center transition-all duration-[500ms] relative z-10",
                    a ? "scale-110" : "scale-100"
                  )}
                  style={{
                    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={a ? 2.5 : 1.75}
                    className={cn(
                      "m-1 transition-all duration-[500ms]",
                      a ? item.color : "text-[var(--color-text-muted)]"
                    )}
                  />
                </div>

                {/* Label — iOS style short label */}
                <span
                  className={cn(
                    "text-[10px] leading-none transition-all duration-[500ms] relative z-10",
                    a
                      ? "font-bold opacity-100"
                      : "font-medium opacity-50"
                  )}
                  style={{
                    color: a ? "inherit" : "var(--color-text-muted)",
                    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                  }}
                >
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
