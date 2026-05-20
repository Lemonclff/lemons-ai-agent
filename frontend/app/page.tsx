"use client";

import { useEffect, useState } from "react";
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
  HardDrive,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, fmtNum, fmtUSD, fmtDuration } from "@/lib/utils";

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    cronCount: 0,
    cronOk: 0,
    dbTables: 0,
    dbRows: 0,
    systemStatus: { gateway: false, cron: false, db: false },
    loading: true,
  });

  useEffect(() => {
    async function load() {
      const results: Partial<DashboardData> = { loading: false };

      // Fetch cron jobs
      try {
        const cronRes = await fetch("/api/cron?action=list");
        const cronData = await cronRes.json();
        if (cronData.ok && cronData.jobs) {
          results.cronCount = cronData.jobs.length;
          results.cronOk = cronData.jobs.filter((j: { status: string }) => j.status === "active").length;
          results.systemStatus = { ...results.systemStatus, cron: true };
        }
      } catch { /* cron unavailable */ }

      // Fetch DB stats
      try {
        const dbRes = await fetch("/api/db");
        const dbData = await dbRes.json();
        if (dbData.rows) {
          const counts: Record<string, number> = {};
          let totalRows = 0;
          for (const r of dbData.rows) {
            counts[r.tbl] = r.rows || r.n || 0;
            totalRows += r.rows || r.n || 0;
          }
          results.dbTables = dbData.rows.length;
          results.dbRows = totalRows;
          results.systemStatus = { ...results.systemStatus, db: true };
        }
      } catch { /* db unavailable */ }

      setData((prev) => ({ ...prev, ...results }));
    }

    load();
    const interval = setInterval(load, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const { cronCount, cronOk, dbTables, dbRows, systemStatus } = data;

  const stats = [
    {
      label: "Active Cron Jobs",
      value: data.loading ? "—" : `${cronOk}/${cronCount}`,
      sub: cronCount > 0 ? `${cronCount} total configured` : "No cron jobs",
      icon: Clock,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      href: "/schedule",
    },
    {
      label: "DB Records",
      value: data.loading ? "—" : fmtNum(dbRows, 0),
      sub: `${dbTables} tables`,
      icon: HardDrive,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      href: "/data",
    },
  ];

  const quickLinks = [
    {
      title: "Schedule & Automation",
      desc: `Manage ${cronCount} cron jobs for sector rotation analysis, pre/post-market reports.`,
      icon: Clock,
      href: "/schedule",
    },
  ];

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to{" "}
          <span className="gradient-text">Lemon&apos;s AI Agent</span>
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          AI-driven US stock quant dashboard — monitor markets, automate analysis, and track your LLM usage.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card hover className="h-full">
              <div className="flex items-start justify-between">
                <div className={stat.bg + " p-3 rounded-xl"}>
                  <stat.icon size={20} className={stat.color} />
                </div>
                {stat.label === "Active Cron Jobs" && (
                  <Badge variant={cronCount > 0 ? "success" : "warning"} size="sm">
                    {cronCount > 0 ? "Running" : "Idle"}
                  </Badge>
                )}
                {stat.label === "DB Records" && (
                  <Badge variant={dbRows > 0 ? "success" : "warning"} size="sm">
                    {dbRows > 0 ? "Connected" : "Empty"}
                  </Badge>
                )}
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{stat.label}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.sub}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Links + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Links */}
        <div className="lg:col-span-2 space-y-4">
          {quickLinks.map((link) => (
            <Link key={link.title} href={link.href}>
              <Card hover className="relative overflow-hidden group h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <link.icon size={24} className="text-[var(--color-accent)]" />
                    <CardTitle>{link.title}</CardTitle>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">{link.desc}</p>
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
                detail: systemStatus.gateway ? "Messaging online" : "Check gateway",
              },
              {
                name: "Cron Engine",
                ok: systemStatus.cron,
                detail: systemStatus.cron ? `${cronOk}/${cronCount} jobs active` : "No cron API",
              },
              {
                name: "Database",
                ok: systemStatus.db,
                detail: systemStatus.db ? `${dbTables} tables, ${fmtNum(dbRows, 0)} rows` : "Not connected",
              },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
              >
                {item.ok ? (
                  <Wifi size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <WifiOff size={14} className="text-[var(--color-text-muted)] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{item.detail}</p>
                </div>
                <Badge variant={item.ok ? "success" : "warning"} size="sm">
                  {item.ok ? "OK" : "Off"}
                </Badge>
              </div>
            ))}

          </div>
        </Card>
      </div>
    </div>
  );
}
