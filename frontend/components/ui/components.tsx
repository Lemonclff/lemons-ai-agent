"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ================================================================
   Tabs
   ================================================================ */
interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: "default" | "pills" | "underline";
  className?: string;
  children?: ReactNode;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "default",
  className,
}: TabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 overscroll-x-contain",
        "snap-x snap-mandatory sm:snap-none",
        variant === "underline" && "border-b border-[var(--color-border)]",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap",
              "disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] snap-start shrink-0",
              "active:scale-[0.97]",
              // Variant: default (bg-highlight)
              variant === "default" && [
                isActive
                  ? "bg-[var(--color-accent)] text-white shadow-glow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
              ],
              // Variant: pills
              variant === "pills" && [
                isActive
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)] nav-active-glow"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
              ],
              // Variant: underline
              variant === "underline" && [
                "rounded-none border-b-2 -mb-[1px]",
                isActive
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              ]
            )}
          >
            {Icon && <Icon size={18} />}
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-medium rounded-md",
                  isActive
                    ? variant === "default"
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                    : "bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================
   Skeleton
   ================================================================ */
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, width, height = "1rem" }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4",
        className
      )}
      aria-hidden="true"
    >
      <Skeleton width="60%" height="1.25rem" />
      <Skeleton width="40%" height="2rem" />
      <div className="space-y-2">
        <Skeleton height="0.75rem" />
        <Skeleton width="80%" height="0.75rem" />
      </div>
    </div>
  );
}

/* ================================================================
   Tooltip
   ================================================================ */
interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-flex group">
      {children}
      <div
        className={cn(
          "absolute z-50 px-3 py-1.5 text-xs font-medium rounded-lg shadow-lg pointer-events-none",
          "bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap",
          positionStyles[position]
        )}
        role="tooltip"
      >
        {content}
        {/* Arrow */}
        <div
          className={cn(
            "absolute w-2 h-2 rotate-45 bg-[var(--color-surface-overlay)] border border-[var(--color-border)]",
            position === "top" &&
              "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-t-0 border-l-0",
            position === "bottom" &&
              "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-b-0 border-r-0",
            position === "left" &&
              "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-l-0 border-b-0",
            position === "right" &&
              "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-r-0 border-t-0"
          )}
        />
      </div>
    </div>
  );
}

/* ================================================================
   Switch / Toggle
   ================================================================ */
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  size = "md",
}: SwitchProps) {
  const sizeStyles = {
    sm: { track: "w-8 h-4", thumb: "w-3 h-3", translate: "translate-x-4" },
    md: { track: "w-10 h-5", thumb: "w-4 h-4", translate: "translate-x-5" },
  };

  const s = sizeStyles[size];

  return (
    <label
      className={cn(
        "inline-flex items-center gap-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
          s.track,
          checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200",
            s.thumb,
            checked ? s.translate : "translate-x-0"
          )}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
      )}
    </label>
  );
}
