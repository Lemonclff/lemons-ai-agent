import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lemon's AI Agent — US Stock Quant & LLM Observability Dashboard",
  description:
    "US stock quantitative analysis, sector rotation monitoring, and LLM observability powered by Langfuse.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)]">
        <Sidebar />
        {/* Main content area — offset by sidebar width */}
        <main className="ml-[260px] min-h-screen flex flex-col">
          <Navbar />
          <div className="flex-1 p-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
