import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6",
        hover && "card-hover cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold text-[var(--color-text-primary)]",
        className
      )}
    >
      {children}
    </h3>
  );
}
