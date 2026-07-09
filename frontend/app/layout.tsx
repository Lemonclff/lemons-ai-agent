import type { Metadata, Viewport } from "next";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lemon's AI Agent — US Stock Quant & LLM Observability Dashboard",
  description:
    "US stock quantitative analysis, sector rotation monitoring, and options volatility dashboard.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)]">
        <a href="#main-content" className="skip-to-content">Skip to main content</a>
        <ThemeProvider>
          <ToastProvider>
            <LayoutShell>{children}</LayoutShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
