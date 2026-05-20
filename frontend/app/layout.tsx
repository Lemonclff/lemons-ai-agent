import type { Metadata } from "next";
import { LayoutShell } from "@/components/layout/LayoutShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lemon's AI Agent — US Stock Quant & LLM Observability Dashboard",
  description:
    "US stock quantitative analysis, sector rotation monitoring, and options volatility dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)]">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
