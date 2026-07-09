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
  return <div className={cn("space-y-6", className)}>{children}</div>;
}

/* ================================================================
   PageHeader — consistent page title + description
   ================================================================ */
interface PageHeaderProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
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
        "rounded-xl border border-[var(--color-border)] overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto scrollbar-none">
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
        "px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface)] border-b border-[var(--color-border)] whitespace-nowrap",
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
        "px-4 py-3 text-[var(--color-text-primary)] border-b border-[var(--color-border-light)] whitespace-nowrap",
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
        "transition-colors duration-150 hover:bg-[var(--color-surface-elevated)]",
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
    <div className={cn("grid gap-4", colClasses[cols], className)}>
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
          "grid grid-cols-1 lg:grid-cols-3 gap-4",
          className
        )}
      >
        <div className="lg:col-span-2 space-y-4">{children}</div>
        <div className="space-y-4">{sidebar}</div>
      </div>
    );
  }
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}>
      {children}
    </div>
  );
}
