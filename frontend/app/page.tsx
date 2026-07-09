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
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PageContainer,
  PageHeader,
  StatsGrid,
  ContentGrid,
} from "@/components/ui/layout-components";
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
      // Always start with initial except loading stays true
      const next: DashboardData = { ...INITIAL, loading: true };
      // Reset systemStatus locally for safe mutation
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

  // ==============================
  // Loading state
  // ==============================
  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          size={24}
          className="animate-spin text-[var(--color-text-muted)]"
        />
      </div>
    );
  }

  // ==============================
  // Stats cards
  // ==============================
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
    } as const,
  ];

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title="Welcome to Lemon's AI Agent"
        description="AI-driven US stock quant dashboard — monitor markets, automate analysis, and track your LLM usage."
      />

      {/* Stats Grid */}
      <StatsGrid cols={2}>
        {statsCards.map((stat) => (
          <Link key={stat.label} href={stat.href} className="block group">
            <Card hover className="h-full">
              <div className="flex items-start justify-between">
                <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                  <stat.icon size={20} className={stat.color} />
                </div>
                <Badge variant={stat.badgeVariant} size="sm">
                  {stat.badge}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight tabular-nums">
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
                  {stat.label}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {stat.sub}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </StatsGrid>

      {/* Content Grid */}
      <ContentGrid
        sidebar={
          /* System Status */
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <Badge
                variant={
                  systemStatus.cron && systemStatus.db ? "success" : "warning"
                }
                size="sm"
              >
                {systemStatus.cron && systemStatus.db ? "Healthy" : "Degraded"}
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
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
                    <span className="text-xs font-medium text-[var(--color-text-muted)] min-w-[28px] text-right">
                      {item.ok ? "OK" : "OFF"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        }
      >
        {/* Quick Links */}
        <Link href="/schedule" className="block group">
          <Card hover className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-[var(--color-gold)]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <Clock size={24} className="text-[var(--color-accent)]" />
                <CardTitle>Schedule & Automation</CardTitle>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Manage {cronCount} cron jobs for sector rotation analysis,
                pre/post-market reports.
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors">
                Open <ArrowRight size={14} />
              </span>
            </div>
          </Card>
        </Link>
      </ContentGrid>
    </PageContainer>
  );
}
