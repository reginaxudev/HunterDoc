"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Shield, UserCog } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { AuthUser } from "@/components/AuthProvider";
import { LOGIN_PASSWORD } from "@/lib/auth/login-hints";
import { refreshTeamMembersCache } from "@/lib/team-members";

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "MEMBER" as "ADMIN" | "MEMBER",
  });
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [resetStatus, setResetStatus] = useState<
    Record<string, { loading?: boolean; error?: string; success?: string }>
  >({});

  async function loadUsers() {
    setFetching(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") loadUsers();
  }, [loading, user]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "创建失败");
      return;
    }
    setForm({ username: "", name: "", password: "", role: "MEMBER" });
    await refreshTeamMembersCache();
    await loadUsers();
  }

  async function resetPassword(id: string) {
    const password = (resetPasswords[id] ?? "").trim();
    if (!password) {
      setResetStatus((prev) => ({
        ...prev,
        [id]: { error: "请输入新密码" },
      }));
      return;
    }
    if (password.length < 6) {
      setResetStatus((prev) => ({
        ...prev,
        [id]: { error: "新密码至少 6 位" },
      }));
      return;
    }

    setResetStatus((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetStatus((prev) => ({
          ...prev,
          [id]: { error: data.error ?? "重置失败" },
        }));
        return;
      }
      setResetPasswords((prev) => ({ ...prev, [id]: "" }));
      setResetStatus((prev) => ({
        ...prev,
        [id]: { success: "密码已重置" },
      }));
      window.setTimeout(() => {
        setResetStatus((prev) => {
          const next = { ...prev };
          if (next[id]?.success) delete next[id];
          return next;
        });
      }, 3000);
    } catch {
      setResetStatus((prev) => ({
        ...prev,
        [id]: { error: "网络错误，请重试" },
      }));
    }
  }

  async function toggleActive(target: AuthUser) {
    const res = await fetch(`/api/users/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !target.active }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "操作失败");
      return;
    }
    await loadUsers();
  }

  if (loading || fetching) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
        需要管理员权限
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2">
          <UserCog className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">团队成员管理</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form
          onSubmit={createUser}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-800">
            <Plus className="h-4 w-4" />
            添加成员
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="用户名（登录用）"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="显示姓名"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <textarea
              rows={1}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={`初始密码（例如 ${LOGIN_PASSWORD}）`}
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              className="resize-none overflow-hidden rounded-md border border-gray-200 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-blue-400"
            />
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as "ADMIN" | "MEMBER" })
              }
              className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none"
            >
              <option value="MEMBER">普通成员</option>
              <option value="ADMIN">管理员</option>
            </select>
          </div>
          <button
            type="submit"
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            创建账号
          </button>
        </form>

        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name.slice(0, 1)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{u.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                      登录名 @{u.username}
                    </span>
                    {u.role === "ADMIN" && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        <Shield className="h-3 w-3" />
                        管理员
                      </span>
                    )}
                  </div>
                </div>
                {u.id !== user.id && (
                  <button
                    type="button"
                    onClick={() => toggleActive(u)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    停用
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetPasswords[u.id] ?? ""}
                    onChange={(e) => {
                      setResetPasswords((prev) => ({
                        ...prev,
                        [u.id]: e.target.value,
                      }));
                      setResetStatus((prev) => {
                        if (!prev[u.id]) return prev;
                        const next = { ...prev };
                        delete next[u.id];
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void resetPassword(u.id);
                      }
                    }}
                    placeholder="新密码（明文）"
                    autoComplete="off"
                    spellCheck={false}
                    data-1p-ignore
                    className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 font-mono text-xs text-gray-900 outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    disabled={resetStatus[u.id]?.loading}
                    onClick={() => void resetPassword(u.id)}
                    className="shrink-0 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {resetStatus[u.id]?.loading ? "重置中..." : "重置密码"}
                  </button>
                </div>
                {resetStatus[u.id]?.error && (
                  <p className="text-xs text-red-600">{resetStatus[u.id]?.error}</p>
                )}
                {resetStatus[u.id]?.success && (
                  <p className="text-xs text-emerald-600">{resetStatus[u.id]?.success}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
