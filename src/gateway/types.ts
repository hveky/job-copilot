// 模型网关类型 —— 全部以 Anthropic Messages 格式为统一口径。
// DeepSeek 走 /anthropic 兼容端点,Claude 走官方端点,只切 base_url+key+model。

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/** 任务档位 → 决定路由到哪个 provider+model(见 PRD §9 模型分层) */
export type Tier = "light" | "deep" | "premium";

export type AuthStyle = "x-api-key" | "bearer";

export interface ProviderConfig {
  /** Anthropic Messages 端点的 base url(到 /v1 之前)。dev 下走 vite 代理路径。 */
  baseUrl: string;
  apiKey: string;
  model: string;
  authStyle: AuthStyle;
}

/** light/deep 默认走 DeepSeek;premium 走 Claude。 */
export interface GatewayConfig {
  light: ProviderConfig; // DeepSeek V4 Flash
  deep: ProviderConfig; // DeepSeek V4 Pro
  premium: ProviderConfig; // Claude Opus 4.8
}

export interface ChatRequest {
  tier: Tier;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** 增量回调:每段新文本触发一次。 */
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}
