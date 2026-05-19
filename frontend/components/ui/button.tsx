"use client";

import { cn } from "@/lib/utils";

// 簡單的 Button 組件（無需 shadcn 依賴）
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
    secondary:
      "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] border border-[var(--color-border)]",
    ghost:
      "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
    danger:
      "bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-600/20",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
