"use client";

import { useState } from "react";
import {
  Plus,
  Play,
  Pause,
  Edit3,
  Trash2,
  Clock,
  Calendar,
  ChevronDown,
  RefreshCw,
  Info,
  Terminal,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";

/* ===== Types ===== */
interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  scheduleLabel: string;
  lastRun?: string;
  nextRun: string;
  status: "active" | "paused" | "failed" | "running";
  script: string;
  tags: string[];
}

/* ===== Mock Data ===== */
const mockJobs: CronJob[] = [
  {
    id: "sector-pre",
    name: "Sector Rotation — Pre-Market",
    description:
      "Analyze GICS sector ETF flows, relative strength, and institutional positioning before US market open.",
    schedule: "30 21 * * 1-5",
    scheduleLabel: "Daily 21:30 HKT (Pre-market, Mon–Fri)",
    lastRun: new Date(Date.now() - 8 * 3600000).toISOString(),
    nextRun: "Tonight 21:30 HKT",
    status: "active",
    script: "scripts/sector_rotation.py --session pre",
    tags: ["sector-rotation", "pre-market", "critical"],
  },
  {
    id: "sector-post",
    name: "Sector Rotation — Post-Market",
    description:
      "Capture end-of-day sector performance, volume anomalies, and generate daily summary report.",
    schedule: "0 5 * * 1-5",
    scheduleLabel: "Daily 05:00 HKT (Post-market, Mon–Fri)",
    lastRun: new Date(Date.now() - 20 * 3600000).toISOString(),
    nextRun: "Tomorrow 05:00 HKT",
    status: "active",
    script: "scripts/sector_rotation.py --session post",
    tags: ["sector-rotation", "post-market"],
  },
  {
    id: "fund-flow-daily",
    name: "Institutional Fund Flow Tracker",
    description:
      "Track large-block trades, dark pool activity, and options flow for institutional signal detection.",
    schedule: "0 */4 * * 1-5",
    scheduleLabel: "Every 4 hours (Mon–Fri)",
    lastRun: new Date(Date.now() - 4 * 3600000).toISOString(),
    nextRun: "In ~4 hours",
    status: "paused",
    script: "scripts/fund_flow.py",
    tags: ["fund-flow", "institutional"],
  },
];

/* ===== Components ===== */

function StatusDot({ status }: { status: CronJob["status"] }) {
  const colors = {
    active: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]",
    paused: "bg-amber-400",
    failed: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]",
    running: "bg-blue-400 animate-pulse shadow-[0_0_6px_rgba(96,165,250,0.6)]",
  };
  return <span className={cn("w-2.5 h-2.5 rounded-full", colors[status])} />;
}

function CronJobCard({ job }: { job: CronJob }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "group transition-all duration-200",
        expanded && "border-[var(--color-accent)]/50"
      )}
    >
      {/* Header Row */}
      <div className="flex items-center gap-4">
        <StatusDot status={job.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{job.name}</h3>
            <Badge
              variant={
                job.status === "active"
                  ? "success"
                  : job.status === "paused"
                  ? "warning"
                  : job.status === "failed"
                  ? "danger"
                  : "info"
              }
              size="sm"
            >
              {job.status}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">
            {job.scheduleLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" title="Run now">
            <Play size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Toggle pause">
            <Pause size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Edit">
            <Edit3 size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Delete">
            <Trash2 size={14} className="text-red-400" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDown
              size={14}
              className={cn(
                "transition-transform",
                expanded && "rotate-180"
              )}
            />
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-4 animate-[slideIn_0.2s_ease-out]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {job.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DetailItem
              label="Cron Expression"
              value={job.schedule}
              icon={<Clock size={14} />}
            />
            <DetailItem
              label="Last Run"
              value={job.lastRun ? timeAgo(job.lastRun) : "Never"}
              icon={<RefreshCw size={14} />}
            />
            <DetailItem
              label="Next Run"
              value={job.nextRun}
              icon={<Calendar size={14} />}
            />
          </div>

          {/* Script Command */}
          <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-xs text-[var(--color-text-secondary)] flex items-center justify-between group/cmd">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-[var(--color-text-muted)]" />
              <code>$ {job.script}</code>
            </div>
            <Button variant="ghost" size="sm">
              <Copy size={12} />
            </Button>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2">
            {job.tags.map((tag) => (
              <Badge key={tag} variant="default" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <span className="text-[var(--color-text-muted)]">{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="text-sm font-mono">{value}</p>
      </div>
    </div>
  );
}

/* ===== Setup Guide ===== */
function SetupGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      title: "1. Install Python Dependencies",
      cmd: "cd scripts && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt",
    },
    {
      title: "2. Add Cron Job (Linux/WSL)",
      cmd: 'crontab -e\n# Add these lines:\n30 21 * * 1-5 cd /home/lemon/lemons-ai-agent && .venv/bin/python scripts/sector_rotation.py --session pre >> logs/pre_market.log 2>&1\n0 5 * * 1-5 cd /home/lemon/lemons-ai-agent && .venv/bin/python scripts/sector_rotation.py --session post >> logs/post_market.log 2>&1',
    },
    {
      title: "3. Verify Cron is Running",
      cmd: "crontab -l | grep sector_rotation",
    },
    {
      title: "4. Manual Test Run",
      cmd: "source .venv/bin/activate && python scripts/sector_rotation.py --session pre --dry-run",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info size={18} className="text-[var(--color-accent)]" />
          <CardTitle>Setup Guide — Cron Job Configuration</CardTitle>
        </div>
        <Badge variant="info" size="sm">
          Step-by-step
        </Badge>
      </CardHeader>

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.title}
            className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
          >
            <p className="text-sm font-medium mb-2">{step.title}</p>
            <div className="relative">
              <pre className="p-3 rounded-lg bg-[var(--color-surface-elevated)] text-xs font-mono text-[var(--color-text-secondary)] overflow-x-auto">
                {step.cmd}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyCmd(step.cmd)}
              >
                {copied === step.cmd ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* DST Note */}
      <div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <p className="text-sm font-medium text-amber-400 mb-1">
          Daylight Saving Time (DST) Notice
        </p>
        <p className="text-xs text-amber-400/70">
          US market hours shift with DST. Summer (Mar-Nov): Pre-market 21:30
          HKT. Winter (Nov-Mar): Pre-market 22:30 HKT. The script automatically
          adjusts based on Eastern Time zone. Ensure your server timezone is set
          to HKT (`timedatectl set-timezone Asia/Hong_Kong`).
        </p>
      </div>
    </Card>
  );
}

/* ===== Page ===== */
export default function SchedulePage() {
  const [tab, setTab] = useState<"jobs" | "guide">("jobs");

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-[slideIn_0.4s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule & Automation</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Manage cron jobs for quantitative analysis and automated reporting.
          </p>
        </div>
        <Button>
          <Plus size={16} />
          New Cron Job
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-elevated)] w-fit">
        {(["jobs", "guide"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              tab === t
                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {t === "jobs" ? "Active Jobs" : "Setup Guide"}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "jobs" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>{mockJobs.length} jobs configured</span>
            <span>Auto-refresh every 60s</span>
          </div>
          {mockJobs.map((job) => (
            <CronJobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <SetupGuide />
      )}
    </div>
  );
}
