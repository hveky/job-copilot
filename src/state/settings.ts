// 本地设置(localStorage)。M1 阶段 key 存浏览器;包入 Tauri 后迁到系统安全存储 + Rust。
import type { GatewayConfig } from "../gateway/types";

export interface Settings {
  dsKey: string; // DeepSeek key(默认 light/deep)
  claudeKey: string; // Anthropic key(premium 精修,可空)
  dsBaseUrl: string;
  claudeBaseUrl: string;
  modelFlash: string;
  modelPro: string;
  modelOpus: string;
  resume: string; // 用户简历全文 / 要点
}

const KEY = "qzc.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  dsKey: "",
  claudeKey: "",
  dsBaseUrl: "/api/ds/anthropic", // dev 代理 → api.deepseek.com/anthropic
  claudeBaseUrl: "/api/anthropic", // dev 代理 → api.anthropic.com
  modelFlash: "deepseek-v4-flash",
  modelPro: "deepseek-v4-pro",
  modelOpus: "claude-opus-4-8",
  resume: "",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** 由 Settings 组装网关三档配置。 */
export function toGatewayConfig(s: Settings): GatewayConfig {
  return {
    light: {
      baseUrl: s.dsBaseUrl,
      apiKey: s.dsKey,
      model: s.modelFlash,
      authStyle: "x-api-key",
    },
    deep: {
      baseUrl: s.dsBaseUrl,
      apiKey: s.dsKey,
      model: s.modelPro,
      authStyle: "x-api-key",
    },
    premium: {
      baseUrl: s.claudeBaseUrl,
      apiKey: s.claudeKey,
      model: s.modelOpus,
      authStyle: "x-api-key",
    },
  };
}
