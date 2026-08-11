const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export type OpenAIConfigOverrides = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

/** Strip quotes and whitespace from env values. */
function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  return trimmed || undefined;
}

function cleanValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed || undefined;
}

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: "env" | "request";
}

export function getOpenAIConfig(
  overrides?: OpenAIConfigOverrides
): OpenAIConfig | null {
  const overrideKey = cleanValue(overrides?.apiKey);
  const envKey = readEnv("OPENAI_API_KEY");
  const apiKey = overrideKey ?? envKey;
  if (!apiKey) return null;

  const baseUrl = (
    cleanValue(overrides?.baseUrl) ??
    readEnv("OPENAI_BASE_URL") ??
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
  const model =
    cleanValue(overrides?.model) ?? readEnv("OPENAI_MODEL") ?? DEFAULT_MODEL;

  return {
    apiKey,
    baseUrl,
    model,
    source: overrideKey ? "request" : "env",
  };
}

export function getOpenAIStatus(overrides?: OpenAIConfigOverrides) {
  const config = getOpenAIConfig(overrides);
  return {
    configured: Boolean(config),
    model: config?.model ?? DEFAULT_MODEL,
    baseUrl: config?.baseUrl ?? DEFAULT_BASE_URL,
    source: config?.source ?? null,
  };
}

export async function createChatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    config?: OpenAIConfigOverrides;
  }
): Promise<{ content: string } | { error: string; status?: number }> {
  const config = getOpenAIConfig(options?.config);
  if (!config) {
    return { error: "未配置 OPENAI_API_KEY" };
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 800,
      }),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        detail = errBody?.error?.message ?? errBody?.message ?? detail;
      } catch {
        const text = await response.text();
        if (text) detail = text.slice(0, 200);
      }
      return { error: detail, status: response.status };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { error: "API 返回为空" };
    }
    return { content };
  } catch (err) {
    const message = err instanceof Error ? err.message : "网络请求失败";
    return { error: message };
  }
}

export function upsertEnvLines(
  content: string,
  vars: Record<string, string | undefined>
): string {
  const lines = content ? content.split("\n") : [];
  const keys = Object.keys(vars);

  for (const key of keys) {
    const value = vars[key];
    if (value == null) continue;
    const idx = lines.findIndex((line) => line.startsWith(`${key}=`));
    const next = `${key}=${value}`;
    if (idx >= 0) lines[idx] = next;
    else lines.push(next);
  }

  return lines.filter((line, i, arr) => line !== "" || i < arr.length - 1).join("\n");
}

export function applyEnvToProcess(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value != null) process.env[key] = value;
  }
}
