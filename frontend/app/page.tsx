"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  HardDrive,
  ArrowRight,
  Wifi,
  WifiOff,
  Loader2,
  Sparkles,
  Activity,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PageContainer,
  PageHeader,
  StatsGrid,
  ContentGrid,
} from "@/components/ui/layout-components";
import { Stagger } from "@/components/ui/effects";
import { cn, fmtNum } from "@/lib/utils";

interface DashboardData {
  cronCount: number;
  cronOk: number;
  dbTables: number;
  dbRows: number;
  systemStatus: {
    gateway: boolean;
    cron: boolean;
    db: boolean;
  };
  loading: boolean;
}

const INITIAL: DashboardData = {
  cronCount: 0,
  cronOk: 0,
  dbTables: 0,
  dbRows: 0,
  systemStatus: { gateway: false, cron: false, db: false },
  loading: true,
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next: DashboardData = { ...INITIAL, loading: true };
      const status = { ...INITIAL.systemStatus };

      try {
        const cronRes = await fetch("/api/cron?action=list");
        const cronData = await cronRes.json();
        if (!cancelled && cronData.ok && cronData.jobs) {
          next.cronCount = cronData.jobs.length;
          next.cronOk = cronData.jobs.filter(
            (j: { status: string }) => j.status === "active"
          ).length;
          next.systemStatus = { ...status, cron: true };
          status.cron = true;
        }
      } catch {
        /* cron unavailable */
      }

      try {
        const dbRes = await fetch("/api/db");
        const dbData = await dbRes.json();
        if (!cancelled && dbData.rows) {
          let totalRows = 0;
          for (const r of dbData.rows) {
            totalRows += r.rows || r.n || 0;
          }
          next.dbTables = dbData.rows.length;
          next.dbRows = totalRows;
          next.systemStatus = { ...status, db: true };
          status.db = true;
        }
      } catch {
        /* db unavailable */
      }

      if (!cancelled) {
        next.loading = false;
        setData(next);
      }
    }

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const { cronCount, cronOk, dbTables, dbRows, systemStatus } = data;

  if (data.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[var(--color-accent)]/20 blur-xl animate-pulse" />
          <Loader2
            size={28}
            className="relative animate-spin text-[var(--color-accent)]"
          />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Loading dashboard…</p>
      </div>
    );
  }

  const statsCards = [
    {
      label: "Active Cron Jobs",
      value: `${cronOk}/${cronCount}`,
      sub: cronCount > 0 ? `${cronCount} total configured` : "No cron jobs",
      icon: Clock,
      color: "text-[var(--color-success)]",
      bg: "bg-[var(--color-success-muted)]",
      href: "/schedule",
      badge: cronCount > 0 ? "Running" : "Idle",
      badgeVariant: cronCount > 0 ? "success" : "warning",
      glow: "group-hover:shadow-[0_0_24px_rgba(34,197,94,0.15)]",
    } as const,
    {
      label: "DB Records",
      value: fmtNum(dbRows, 0),
      sub: `${dbTables} tables`,
      icon: HardDrive,
      color: "text-[var(--color-info)]",
      bg: "bg-[var(--color-info-muted)]",
      href: "/data",
      badge: dbRows > 0 ? "Connected" : "Empty",
      badgeVariant: dbRows > 0 ? "success" : "warning",
      glow: "group-hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]",
    } as const,
  ];

  const healthy = systemStatus.cron && systemStatus.db;

  return (
    <PageContainer>
      <PageHeader
        badge={
          <Badge variant="accent" size="sm" className="gap-1.5">
            <Sparkles size={10} />
            AI Agent Hub
          </Badge>
        }
        title={
          <span>
            Welcome to{" "}
            <span className="gradient-text">Lemon&apos;s AI Agent</span>
          </span>
        }
        description="AI-driven US stock quant dashboard — monitor markets, automate analysis, and track your LLM usage."
      />

      <StatsGrid cols={2}>
        {statsCards.map((stat) => (
          <Link key={stat.label} href={stat.href} className="block group">
            <Card hover shine gradient className={cn("h-full", stat.glow)}>
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110",
                    stat.bg
                  )}
                >
                  <stat.icon size={20} className={stat.color} />
                </div>
                <Badge variant={stat.badgeVariant} size="sm">
                  {stat.badge}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight tabular-nums">
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
                  {stat.label}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {stat.sub}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>
        ))}
      </StatsGrid>

      <ContentGrid
        sidebar={
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[var(--color-accent)]" />
                <CardTitle className="!text-base">System Status</CardTitle>
              </div>
              <Badge variant={healthy ? "success" : "warning"} size="sm">
                {healthy ? (
                  <span className="flex items-center gap-1.5">
                    <span className="pulse-dot !w-1.5 !h-1.5" />
                    Healthy
                  </span>
                ) : (
                  "Degraded"
                )}
              </Badge>
            </CardHeader>
            <div className="space-y-1">
              {[
                {
                  name: "Gateway",
                  ok: systemStatus.gateway,
                  detail: systemStatus.gateway
                    ? "Messaging online"
                    : "Check gateway",
                },
                {
                  name: "Cron Engine",
                  ok: systemStatus.cron,
                  detail: systemStatus.cron
                    ? `${cronOk}/${cronCount} jobs active`
                    : "No cron API",
                },
                {
                  name: "Database",
                  ok: systemStatus.db,
                  detail: systemStatus.db
                    ? `${dbTables} tables, ${fmtNum(dbRows, 0)} rows`
                    : "Not connected",
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--color-surface)] transition-colors"
                >
                  {item.ok ? (
                    <Wifi
                      size={14}
                      className="text-[var(--color-success)] shrink-0"
                    />
                  ) : (
                    <WifiOff
                      size={14}
                      className="text-[var(--color-text-muted)] shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {item.detail}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "status-dot",
                        item.ok ? "online" : "offline"
                      )}
                    />
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] min-w-[28px] text-right tabular-nums">
                      {item.ok ? "OK" : "OFF"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        }
      >
        <Stagger className="space-y-3 sm:space-y-4">
          <Link href="/schedule" className="block group">
            <Card hover shine className="relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br from-[var(--color-accent)]/15 to-transparent blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-[var(--color-accent-muted)]">
                    <Clock size={20} className="text-[var(--color-accent)]" />
                  </div>
                  <CardTitle>Schedule & Automation</CardTitle>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                  Manage {cronCount} cron jobs for sector rotation analysis,
                  pre/post-market reports.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] group-hover:gap-2.5 transition-all">
                  Open <ArrowRight size={14} />
                </span>
              </div>
            </Card>
          </Link>

          <Link href="/ai-analysis" className="block group">
            <Card hover shine className="relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br from-purple-500/15 to-transparent blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10">
                    <Sparkles size={20} className="text-purple-400" />
                  </div>
                  <CardTitle>AI 資產分析</CardTitle>
                  <Badge variant="accent" size="sm">
                    LLM
                  </Badge>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                  LLM-powered portfolio and market analysis with structured
                  insights.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] group-hover:gap-2.5 transition-all">
                  Open <ArrowRight size={14} />
                </span>
              </div>
            </Card>
          </Link>
        </Stagger>
      </ContentGrid>
    </PageContainer>
  );
}
