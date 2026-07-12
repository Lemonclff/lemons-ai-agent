"use client";

import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-glow-sm btn-glow active:scale-[0.97]",
    secondary:
      "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] border border-[var(--color-border)] active:scale-[0.97]",
    ghost:
      "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] active:scale-[0.97]",
    danger:
      "bg-[var(--color-danger-muted)] text-[var(--color-danger)] hover:bg-red-600/20 border border-red-600/20 active:scale-[0.97]",
    outline:
      "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-accent)] active:scale-[0.97]",
  };

  const sizes = {
    sm: "px-3 py-2 text-xs rounded-lg min-h-[40px] sm:min-h-[36px]",
    md: "px-4 py-2.5 text-sm rounded-xl min-h-[44px]",
    lg: "px-6 py-3 text-base rounded-xl min-h-[48px]",
    icon: "p-2.5 rounded-xl min-h-[44px] min-w-[44px]",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium",
        "transition-all duration-200 ease-out-expo",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50",
        "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
        "select-none",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
