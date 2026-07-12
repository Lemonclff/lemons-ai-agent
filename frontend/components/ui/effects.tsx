"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode, CSSProperties } from "react";

/* ================================================================
   AmbientBackground — floating mesh orbs + optional noise
   ================================================================ */
export function AmbientBackground({
  className,
  noise = true,
}: {
  className?: string;
  noise?: boolean;
}) {
  return (
    <>
      <div className={cn("ambient-bg", className)} aria-hidden="true" />
      {noise && <div className="noise-overlay" aria-hidden="true" />}
    </>
  );
}

/* ================================================================
   PageTransition — re-mount on route change for enter animation
   ================================================================ */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={cn("page-enter", className)}>
      {children}
    </div>
  );
}

/* ================================================================
   FadeIn — single element entrance
   ================================================================ */
export function FadeIn({
  children,
  className,
  delay = 0,
  direction = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "none" | "scale";
}) {
  const anim =
    direction === "scale"
      ? "animate-scale-in"
      : direction === "none"
        ? "animate-fade-in"
        : "animate-fade-up";

  return (
    <div
      className={cn(anim, className)}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" } as CSSProperties}
    >
      {children}
    </div>
  );
}

/* ================================================================
   Stagger — children enter one after another
   ================================================================ */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("stagger-children", className)}>{children}</div>;
}

/* ================================================================
   GradientOrb — decorative accent blob
   ================================================================ */
export function GradientOrb({
  className,
  color = "accent",
}: {
  className?: string;
  color?: "accent" | "gold" | "purple" | "success";
}) {
  const colors = {
    accent: "from-indigo-500/30 to-violet-500/10",
    gold: "from-amber-500/30 to-orange-500/10",
    purple: "from-purple-500/30 to-fuchsia-500/10",
    success: "from-emerald-500/30 to-teal-500/10",
  };

  return (
    <div
      className={cn(
        "absolute rounded-full bg-gradient-to-br blur-3xl pointer-events-none",
        colors[color],
        className
      )}
      aria-hidden="true"
    />
  );
}

/* ================================================================
   IconBadge — circular icon container with soft glow
   ================================================================ */
export function IconBadge({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-2xl p-2.5",
        "bg-[var(--color-accent-muted)] text-[var(--color-accent)]",
        glow && "shadow-[0_0_20px_var(--color-accent-glow)]",
        className
      )}
    >
      {children}
    </div>
  );
}
