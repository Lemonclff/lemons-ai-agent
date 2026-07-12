import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
  size?: "sm" | "md";
  className?: string;
}

const variants = {
  default: "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
  success: "bg-[var(--color-success-muted)] text-[var(--color-success)] border border-emerald-500/15",
  warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning)] border border-amber-500/15",
  danger: "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-red-500/15",
  info: "bg-[var(--color-info-muted)] text-[var(--color-info)] border border-blue-500/15",
  accent: "bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-indigo-500/15",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({ children, variant = "default", size = "md", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tracking-wide",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
