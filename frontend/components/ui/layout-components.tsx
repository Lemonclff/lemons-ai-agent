import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ================================================================
   PageContainer — unified page wrapper
   ================================================================ */
interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("space-y-5 sm:space-y-6", className)}>{children}</div>
  );
}

/* ================================================================
   PageHeader — consistent page title + description
   ================================================================ */
interface PageHeaderProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
  badge?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  badge,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {badge && <div className="mb-1">{badge}</div>}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)] leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   TableWrapper — responsive table with horizontal scroll
   ================================================================ */
interface TableWrapperProps {
  children: ReactNode;
  className?: string;
}

export function TableWrapper({ children, className }: TableWrapperProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-secondary)] shadow-card",
        className
      )}
    >
      <div className="overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

/* ================================================================
   Table header/row/cell helpers
   ================================================================ */
export function Th({
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 sm:px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface)]/80 border-b border-[var(--color-border)] whitespace-nowrap",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-3 sm:px-4 py-3 text-[var(--color-text-primary)] border-b border-[var(--color-border-light)] whitespace-nowrap",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150 hover:bg-[var(--color-surface-elevated)]/70",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

/* ================================================================
   StatsGrid — responsive stats card grid
   ================================================================ */
interface StatsGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function StatsGrid({ children, cols = 4, className }: StatsGridProps) {
  const colClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-3 sm:gap-4 stagger-children", colClasses[cols], className)}>
      {children}
    </div>
  );
}

/* ================================================================
   ContentGrid — responsive 2-column layout
   ================================================================ */
interface ContentGridProps {
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export function ContentGrid({ children, sidebar, className }: ContentGridProps) {
  if (sidebar) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4",
          className
        )}
      >
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">{children}</div>
        <div className="space-y-3 sm:space-y-4">{sidebar}</div>
      </div>
    );
  }
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4", className)}>
      {children}
    </div>
  );
}

/* ================================================================
   EmptyState — friendly empty / error placeholder
   ================================================================ */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className
      )}
    >
      {icon && (
        <div className="mb-4 p-4 rounded-2xl bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
