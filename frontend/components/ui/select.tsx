"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, placeholder, id, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {label}
            {props.required && (
              <span className="text-[var(--color-danger)] ml-0.5">*</span>
            )}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "w-full px-3.5 py-2.5 text-sm rounded-xl border bg-[var(--color-surface)] appearance-none cursor-pointer",
              "text-[var(--color-text-primary)]",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error
                ? "border-[var(--color-danger)]"
                : "border-[var(--color-border)]",
              className
            )}
            aria-invalid={error ? "true" : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]"
          />
        </div>
        {error && (
          <p className="text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
