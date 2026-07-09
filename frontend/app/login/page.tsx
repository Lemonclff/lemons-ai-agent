"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { theme, toggleTheme } = useTheme();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登入失敗");
        setLoading(false);
        return;
      }

      router.push(redirect);
    } catch {
      setError("連線失敗，請重試");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-4">
      {/* Theme toggle (top-right corner) */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-all border border-[var(--color-border)]"
        aria-label={theme === "dark" ? "切換至淺色模式" : "切換至深色模式"}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-accent-muted)] mb-4">
            <Lock size={28} className="text-[var(--color-accent)]" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            <span className="gradient-text">Lemon&apos;s AI Agent</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            請登入以繼續
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="使用者名稱"
            autoFocus
            autoComplete="username"
            required
          />

          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密碼"
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="text-sm text-[var(--color-danger)] text-center animate-[fadeIn_150ms_ease]" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !username || !password}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {loading ? "驗證中..." : "登入"}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
          還沒有帳號？{" "}
          <Link
            href="/register"
            className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors font-medium"
          >
            註冊
          </Link>
        </p>
      </div>
    </div>
  );
}
