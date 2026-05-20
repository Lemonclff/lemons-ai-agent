"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Calendar,
  ChevronDown,
  RefreshCw,
  Info,
  Terminal,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
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
  schedule_label: string;
  last_run?: string;
  next_run?: string;
  status: "active" | "paused" | "failed" | "running";
  script: string;
  tags: string[];
}

/* ===== Components ===== */

function StatusDot({ status }: { status: CronJob["status"] }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]",
    paused: "bg-amber-400",
    failed: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]",
    running: "bg-blue-400 animate-pulse shadow-[0_0_6px_rgba(96,165,250,0.6)]",
  };
  return <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", colors[status] || colors.active)} />;
}

function DetailItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <span className="text-[var(--color-text-muted)] shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-mono truncate">{value}</p>
      </div>
    </div>
  );
}

function SetupGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    { title: "1. Install Python Dependencies", cmd: "cd scripts && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" },
    { title: "2. Add Cron Job (Linux/WSL)", cmd: 'crontab -e\n30 21 * * 1-5 cd /home/lemon/lemons-ai-agent && .venv/bin/python scripts/sector_rotation.py --session pre >> logs/pre_market.log 2>&1\n0 5 * * 1-5 cd /home/lemon/lemons-ai-agent && .venv/bin/python scripts/sector_rotation.py --session post >> logs/post_market.log 2>&1' },
    { title: "3. Verify Cron is Running", cmd: "crontab -l | grep sector_rotation" },
    { title: "4. Manual Test Run", cmd: "source .venv/bin/activate && python scripts/sector_rotation.py --session pre --dry-run" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info size={18} className="text-[var(--color-accent)]" />
          <CardTitle>Setup Guide — Cron Job Configuration</CardTitle>
        </div>
      </CardHeader>
      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.title} className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <p className="text-sm font-medium mb-2">{step.title}</p>
            <div className="relative">
              <pre className="p-3 rounded-lg bg-[var(--color-surface-elevated)] text-xs font-mono text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre-wrap">{step.cmd}</pre>
              <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => copyCmd(step.cmd)}>
                {copied === step.cmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ===== Page ===== */
export default function SchedulePage() {
  const [tab, setTab] = useState<"jobs" | "guide">("jobs");
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Check admin on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron?action=list");
      const data = await res.json();
      if (data.ok) {
        setJobs(data.jobs || []);
        setError("");
      } else {
        setError(data.error || "Failed to load");
      }
    } catch {
      setError("連線失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Control action
  async function handleAction(jobId: string, action: "pause" | "resume" | "run") {
    setActionLoading(jobId);
    setFeedback("");
    try {
      const res = await fetch(`/api/cron?action=${action}&job_id=${jobId}`);
      const data = await res.json();
      if (data.ok) {
        const labels = { pause: "已暫停", resume: "已恢復", run: "已觸發執行" };
        setFeedback(`${jobId}: ${labels[action]}`);
        setTimeout(() => setFeedback(""), 3000);
        // Refresh list
        const refresh = await fetch("/api/cron?action=list");
        const refreshData = await refresh.json();
        if (refreshData.ok) setJobs(refreshData.jobs || []);
      } else {
        setError(data.error || "操作失敗");
      }
    } catch {
      setError("連線失敗");
    } finally {
      setActionLoading(null);
    }
  }

  // Loading state
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  // Non-admin
  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <ShieldAlert size={48} className="mx-auto text-amber-400 mb-4" />
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">權限不足</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Schedule & Automation 僅限管理員使用</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between max-sm:flex-col max-sm:gap-3 max-sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Schedule & Automation</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Manage cron jobs for quantitative analysis and automated reporting.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          <span className="ml-2">Refresh</span>
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
              tab === t ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {t === "jobs" ? `Active Jobs (${jobs.length})` : "Setup Guide"}
          </button>
        ))}
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 animate-[slideIn_0.3s_ease-out]">{feedback}</div>
      )}

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>
      )}

      {/* Content */}
      {tab === "jobs" ? (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isBusy = actionLoading === job.id;
              const expanded = expandedIds.has(job.id);

              return (
                <Card key={job.id} className={cn("group transition-all duration-200", expanded && "border-[var(--color-accent)]/50")}>
                  {/* Header Row */}
                  <div className="flex items-center gap-3 max-sm:flex-wrap">
                    <StatusDot status={job.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">{job.name}</h3>
                        <Badge
                          variant={job.status === "active" ? "success" : job.status === "paused" ? "warning" : job.status === "failed" ? "danger" : "info"}
                          size="sm"
                        >
                          {job.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">{job.schedule_label}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {job.status !== "active" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(job.id, "resume")}
                          disabled={isBusy}
                          title="Resume"
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="text-emerald-400" />}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(job.id, "pause")}
                          disabled={isBusy}
                          title="Pause"
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} className="text-amber-400" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(job.id, "run")}
                        disabled={isBusy}
                        title="Run now"
                      >
                        {isBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(job.id)}>
                        <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-4">
                      <p className="text-sm text-[var(--color-text-secondary)]">{job.description || "No description"}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <DetailItem label="Cron Expression" value={job.schedule || "—"} icon={<Clock size={14} />} />
                        <DetailItem label="Last Run" value={job.last_run ? timeAgo(job.last_run) : "Never"} icon={<RefreshCw size={14} />} />
                        <DetailItem label="Next Run" value={job.next_run || "—"} icon={<Calendar size={14} />} />
                      </div>

                      {/* Script */}
                      {job.script && (
                        <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Terminal size={14} className="text-[var(--color-text-muted)] shrink-0" />
                            <code className="truncate">$ {job.script}</code>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(job.script)}>
                            <Copy size={12} />
                          </Button>
                        </div>
                      )}

                      {/* Tags */}
                      {job.tags?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {job.tags.map((tag) => (
                            <Badge key={tag} variant="default" size="sm">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

            {jobs.length === 0 && !loading && (
              <p className="text-center py-16 text-[var(--color-text-muted)]">暫無排程任務</p>
            )}
          </div>
        )
      ) : (
        <SetupGuide />
      )}
    </div>
  );
}
