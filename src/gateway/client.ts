// 模型网关:统一用 Anthropic Messages 格式 + SSE 流式,按 tier 路由 provider。
// 设计目标(PRD §7):单一请求/响应口径打两家,DeepSeek 默认、Claude 付费精修。
// 上线 Tauri 后,这一层整体下沉到 Rust 核心(key 不进渲染层、无 CORS)。

import type { ChatRequest, GatewayConfig, ProviderConfig } from "./types";

function authHeaders(p: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (p.authStyle === "bearer") h["authorization"] = `Bearer ${p.apiKey}`;
  else h["x-api-key"] = p.apiKey;
  return h;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/**
 * 发起一次对话,流式返回完整文本。onDelta 推送增量。
 * 任一档位缺 key 会抛 GatewayError。
 */
export async function chat(
  cfg: GatewayConfig,
  req: ChatRequest,
): Promise<string> {
  const provider = cfg[req.tier];
  if (!provider.apiKey) {
    throw new GatewayError(
      `未配置 ${req.tier} 档的 API Key,请到「设置」填写。`,
    );
  }

  const body = {
    model: provider.model,
    max_tokens: req.maxTokens ?? 8000,
    stream: true,
    ...(req.system ? { system: req.system } : {}),
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
  };

  const resp = await fetch(`${provider.baseUrl}/v1/messages`, {
    method: "POST",
    headers: authHeaders(provider),
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!resp.ok || !resp.body) {
    let detail = "";
    try {
      detail = await resp.text();
    } catch {
      /* ignore */
    }
    throw new GatewayError(
      `请求失败 (${resp.status}) ${detail.slice(0, 300)}`,
      resp.status,
    );
  }

  return await consumeAnthropicSSE(resp.body, req.onDelta, req.onThinking);
}

/** 非流式 + tool-use:返回原始 Anthropic 响应(content 块数组)。给文件 agent 循环用。 */
export async function chatToolsRaw(
  cfg: GatewayConfig,
  tier: import("./types").Tier,
  body: {
    system?: string;
    messages: unknown[];
    tools?: unknown[];
    maxTokens?: number;
  },
): Promise<any> {
  const provider = cfg[tier];
  if (!provider.apiKey) throw new GatewayError("未配置 API Key。");
  const resp = await fetch(`${provider.baseUrl}/v1/messages`, {
    method: "POST",
    headers: authHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      max_tokens: body.maxTokens ?? 4000,
      ...(body.system ? { system: body.system } : {}),
      messages: body.messages,
      ...(body.tools ? { tools: body.tools } : {}),
      stream: false,
    }),
  });
  if (!resp.ok) {
    let d = "";
    try {
      d = await resp.text();
    } catch {
      /* ignore */
    }
    throw new GatewayError(`请求失败 (${resp.status}) ${d.slice(0, 300)}`, resp.status);
  }
  return await resp.json();
}

/** 解析 Anthropic 风格 SSE,累积 text 增量。DeepSeek /anthropic 端点同构(含 thinking_delta)。 */
async function consumeAnthropicSSE(
  stream: ReadableStream<Uint8Array>,
  onDelta?: (t: string) => void,
  onThinking?: (t: string) => void,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 以空行分隔事件;逐行取 data:
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt: any;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      // content_block_delta -> 正文 text_delta / 推理 thinking_delta
      if (evt.type === "content_block_delta") {
        if (evt.delta?.type === "text_delta" && typeof evt.delta.text === "string") {
          full += evt.delta.text;
          onDelta?.(evt.delta.text);
        } else if (
          evt.delta?.type === "thinking_delta" &&
          typeof evt.delta.thinking === "string"
        ) {
          onThinking?.(evt.delta.thinking);
        }
      }
      if (evt.type === "error") {
        throw new GatewayError(evt.error?.message ?? "流式错误");
      }
    }
  }
  return full;
}
