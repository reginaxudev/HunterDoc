"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixMessage, setFixMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        setLoading(false);
        return;
      }
      await refresh();
      const from = searchParams.get("from") || "/";
      router.push(from);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
      setLoading(false);
    }
  }

  async function handleFixTeamAccounts() {
    setFixing(true);
    setFixMessage("");
    setError("");
    try {
      const res = await fetch("/api/auth/fix-team", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "重置账号失败");
        return;
      }
      setFixMessage(`已重置 ${data.count} 个种子账号，请使用管理员提供的密码登录`);
      setPassword("");
    } catch {
      setError("重置账号失败，请确认开发服务器已启动");
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
            猎
          </div>
          <h1 className="text-xl font-semibold text-gray-900">猎头云文档</h1>
          <p className="mt-1 text-sm text-gray-500">团队登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              用户名
            </label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              也可输入显示姓名；重置过密码请使用新密码
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {fixMessage && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {fixMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            登录
          </button>
        </form>

        {process.env.NODE_ENV !== "production" && (
          <p className="mt-4 text-center text-xs text-gray-400">
            无法登录？
            <button
              type="button"
              disabled={fixing}
              onClick={handleFixTeamAccounts}
              className="ml-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {fixing ? "重置中…" : "重置种子团队账号"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
