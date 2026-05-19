import Link from "next/link";
import {
  Activity,
  Clock,
  TrendingUp,
  Zap,
  ArrowRight,
  BarChart3,
  Cpu,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stats = [
  {
    label: "Active Cron Jobs",
    value: "3",
    sub: "All healthy",
    icon: Clock,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    href: "/schedule",
  },
  {
    label: "Traces Today",
    value: "1,247",
    sub: "+12% vs yesterday",
    icon: Activity,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    href: "/observability",
  },
  {
    label: "Total Tokens",
    value: "2.4M",
    sub: "~$5.20 cost",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    href: "/observability",
  },
  {
    label: "Sectors Tracked",
    value: "11",
    sub: "GICS Level 1",
    icon: Layers,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    href: "/schedule",
  },
];

const quickLinks = [
  {
    title: "Schedule & Automation",
    desc: "Manage cron jobs for sector rotation analysis, pre/post-market reports.",
    icon: Clock,
    href: "/schedule",
    color: "from-emerald-500/20 to-teal-500/20",
  },
  {
    title: "Model Observability",
    desc: "Langfuse traces, token usage, latency monitoring, and cost tracking.",
    icon: Activity,
    href: "/observability",
    color: "from-indigo-500/20 to-purple-500/20",
  },
];

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-[slideIn_0.4s_ease-out]">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to{" "}
          <span className="gradient-text">Lemon's AI Agent</span>
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          AI-driven US stock quant dashboard — monitor markets, automate
          analysis, and track your LLM usage.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card hover className="h-full">
              <div className="flex items-start justify-between">
                <div className={stat.bg + " p-3 rounded-xl"}>{<stat.icon size={20} className={stat.color} />}</div>
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {stat.label}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {stat.sub}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.title} href={link.href}>
            <Card
              hover
              className="relative overflow-hidden group h-full"
            >
              {/* Gradient background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-50 group-hover:opacity-80 transition-opacity`}
              />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <link.icon size={24} className="text-[var(--color-accent)]" />
                  <CardTitle>{link.title}</CardTitle>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  {link.desc}
                </p>
                <div className="flex items-center gap-1 text-sm text-[var(--color-accent)] font-medium">
                  Open <ArrowRight size={14} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <Badge variant="success" size="sm">
            All Systems Operational
          </Badge>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "Langfuse",
              status: "Connected",
              icon: BarChart3,
              detail: "Traces streaming normally",
            },
            {
              name: "Market Data",
              status: "Ready",
              icon: TrendingUp,
              detail: "Yahoo Finance API accessible",
            },
            {
              name: "Cron Engine",
              status: "Running",
              icon: Cpu,
              detail: "Next run: Pre-market (21:30 HKT)",
            },
          ].map((sys) => (
            <div
              key={sys.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
            >
              <div className="p-2 rounded-lg bg-[var(--color-surface-elevated)]">
                <sys.icon size={18} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="text-sm font-medium">{sys.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {sys.detail}
                </p>
              </div>
              <Badge variant="success" size="sm" className="ml-auto">
                {sys.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
