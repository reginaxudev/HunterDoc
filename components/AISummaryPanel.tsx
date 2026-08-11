"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

interface AISummaryPanelProps {
  documentId: string;
  title: string;
  getContent: () => Record<string, unknown> | undefined;
  onClose: () => void;
}

interface AIStatus {
  configured: boolean;
  model: string;
  baseUrl: string;
}

interface ClientAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const STORAGE_KEY = "headhunter_ai_config";

function loadClientConfig(): ClientAIConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientAIConfig;
    return parsed.apiKey ? parsed : null;
  } catch {
    return null;
  }
}

function saveClientConfig(config: ClientAIConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function AISummaryPanel({
  documentId,
  title,
  getContent,
  onClose,
}: AISummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [clientConfig, setClientConfig] = useState<ClientAIConfig>({
    apiKey: "",
    baseUrl: "",
    model: "gpt-4o-mini",
  });

  const isConfigured =
    aiStatus?.configured || Boolean(clientConfig.apiKey.trim());

  useEffect(() => {
    const saved = loadClientConfig();
    if (saved) {
      setClientConfig(saved);
    }
    refreshStatus(Boolean(saved?.apiKey));
  }, []);

  async function refreshStatus(clientHasKey = Boolean(clientConfig.apiKey.trim())) {
    try {
      const res = await fetch(
        `/api/ai/status?clientConfigured=${clientHasKey ? "1" : "0"}`
      );
      setAiStatus(await res.json());
    } catch {
      setAiStatus(null);
    }
  }

  async function saveConfig() {
    const apiKey = clientConfig.apiKey.trim();
    if (!apiKey) {
      setNotice("请先填写 API Key");
      return;
    }

    setSavingConfig(true);
    setNotice(null);
    try {
      const payload = {
        apiKey,
        baseUrl: clientConfig.baseUrl.trim() || undefined,
        model: clientConfig.model.trim() || "gpt-4o-mini",
      };
      saveClientConfig({
        apiKey,
        baseUrl: clientConfig.baseUrl.trim(),
        model: payload.model,
      });
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "保存失败");
      } else {
        setShowConfig(false);
        setNotice("API Key 已保存，可直接生成 AI 摘要");
        await refreshStatus(true);
      }
    } catch {
      setNotice("保存失败，请稍后重试");
    }
    setSavingConfig(false);
  }

  function getRequestConfig() {
    const saved = loadClientConfig();
    if (!saved?.apiKey) return {};
    return {
      apiKey: saved.apiKey,
      baseUrl: saved.baseUrl || undefined,
      model: saved.model || undefined,
    };
  }

  async function generate() {
    if (!isConfigured) {
      setShowConfig(true);
      setNotice("请先配置 OpenAI API Key");
      return;
    }

    setLoading(true);
    setSummary(null);
    setNotice(null);
    try {
      const content = getContent();
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          title,
          content,
          ...getRequestConfig(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSummary(`错误：${data.error}`);
      } else {
        setSummary(data.summary);
        setSource(data.source);
        if (data.reason === "missing_key") {
          setShowConfig(true);
          setNotice(data.message ?? "请先配置 OpenAI API Key");
        } else if (data.reason === "api_error") {
          setNotice(`AI 调用失败：${data.message}。已降级为规则摘要。`);
        }
      }
    } catch {
      setSummary("生成失败，请稍后重试。");
    }
    setLoading(false);
  }

  function copySummary() {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-gray-900">AI 摘要</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-xs ${
            isConfigured
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {isConfigured ? (
            <div className="flex items-center justify-between gap-2">
              <span>AI 已就绪 · {clientConfig.model || aiStatus?.model}</span>
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="text-emerald-800 underline"
              >
                修改
              </button>
            </div>
          ) : (
            <p>尚未配置 API Key，请在下方填写后即可使用 AI 摘要</p>
          )}
        </div>

        {(showConfig || !isConfigured) && (
          <div className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
              <KeyRound className="h-3.5 w-3.5" />
              OpenAI 配置
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={clientConfig.apiKey}
                  onChange={(e) =>
                    setClientConfig((c) => ({ ...c, apiKey: e.target.value }))
                  }
                  placeholder="sk-..."
                  className="w-full rounded-md border border-gray-200 py-2 pl-2.5 pr-8 text-xs outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                模型（可选）
              </label>
              <input
                value={clientConfig.model}
                onChange={(e) =>
                  setClientConfig((c) => ({ ...c, model: e.target.value }))
                }
                placeholder="gpt-4o-mini"
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                API 地址（可选，用于代理/中转）
              </label>
              <input
                value={clientConfig.baseUrl}
                onChange={(e) =>
                  setClientConfig((c) => ({ ...c, baseUrl: e.target.value }))
                }
                placeholder="https://api.openai.com/v1"
                className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-xs outline-none focus:border-violet-400"
              />
            </div>
            <button
              type="button"
              onClick={saveConfig}
              disabled={savingConfig}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {savingConfig ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              保存配置
            </button>
            <p className="text-[10px] leading-relaxed text-gray-400">
              保存后写入 .env.local，并立即生效，无需重启服务
            </p>
          </div>
        )}

        {notice && !summary && (
          <div className="mb-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {!summary && !loading && (
          <div className="text-center">
            <p className="mb-4 text-sm text-gray-500">
              基于当前文档内容，自动生成候选人/项目摘要报告，适合向 Leader
              或客户快速汇报。
            </p>
            <button
              onClick={generate}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              <Sparkles className="h-4 w-4" />
              生成摘要
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <p className="text-sm text-gray-500">AI 正在分析文档...</p>
          </div>
        )}

        {summary && !loading && (
          <div>
            {notice && (
              <div className="mb-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
            {source === "openai" && (
              <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                由 AI 生成
              </div>
            )}
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
              {summary}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={copySummary}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                复制摘要
              </button>
              <button
                onClick={generate}
                className="flex-1 rounded-lg bg-violet-50 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100"
              >
                重新生成
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
