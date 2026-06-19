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
  instruction: string; // 主控指令(CLAUDE.md 式),注入每次 AI 调用的 system 前缀
}

const KEY = "qzc.settings.v1";

/** 默认主控指令:可在边栏「Instruction」里随时改。 */
export const DEFAULT_INSTRUCTION = `# 主控指令(我的偏好,适用于所有生成)
- 我是广州中医药大学中药学 2026 届应届生,求职目标分四赛道:投流/运营、Meta 跨境、AI/Agent、医药 CDM。
- 成果尽量量化(数字、百分比、规模);项目用 STAR 包装。
- 简历改写给「改前 / 改后 + 理由」,不要直接覆盖原稿。
- ⚠️ 绝不替我声称未确认的技能;不确定的能力标注【待核实】。剪映已确认会。
- 语气务实、可直接用,拒绝空话套话。`;

export const DEFAULT_SETTINGS: Settings = {
  dsKey: "",
  claudeKey: "",
  dsBaseUrl: "/api/ds/anthropic", // dev 代理 → api.deepseek.com/anthropic
  claudeBaseUrl: "/api/anthropic", // dev 代理 → api.anthropic.com
  modelFlash: "deepseek-v4-flash",
  modelPro: "deepseek-v4-pro",
  modelOpus: "claude-opus-4-8",
  resume: "",
  instruction: DEFAULT_INSTRUCTION,
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
