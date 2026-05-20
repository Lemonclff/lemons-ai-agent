"use client";

import { useState, FormEvent, useEffect } from "react";
import { ShieldCheck, Search, KeyRound, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminResetPage() {
  const [searchUser, setSearchUser] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check admin on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: searchUser.trim(),
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "重置失敗");
      } else {
        setMessage(data.message);
        setNewPassword("");
        setSearchUser("");
      }
    } catch {
      setError("連線失敗");
    } finally {
      setLoading(false);
    }
  }

  // Loading
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--color-border)] border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          權限不足
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          此頁面僅限管理員存取
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
            <ShieldCheck size={22} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Admin — 密碼重置
          </h1>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] ml-[52px]">
          管理員可為任何使用者重置密碼
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleReset}
        className="space-y-4 bg-[var(--color-surface-elevated)] rounded-2xl p-6 border border-[var(--color-border)]"
      >
        {/* Search user */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            使用者名稱
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="輸入使用者名稱..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
            />
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            新密碼
          </label>
          <div className="relative">
            <KeyRound
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 字元"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
            />
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}
        {message && (
          <div className="px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400">
            {message}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !searchUser || !newPassword}
          className={cn(
            "w-full py-3 rounded-xl font-medium transition-all",
            "bg-amber-500 text-white hover:bg-amber-600",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {loading ? "重置中..." : "重置密碼"}
        </button>
      </form>

      {/* Info */}
      <div className="mt-4 p-4 rounded-xl bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          使用者將被登出（需用新密碼重新登入）。密碼使用 bcrypt hash 儲存，無法還原。
        </p>
      </div>
    </div>
  );
}
