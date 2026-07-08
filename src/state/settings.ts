// 本地设置(localStorage)。M1 阶段 key 存浏览器;包入 Tauri 后迁到系统安全存储 + Rust。
import type { GatewayConfig } from "../gateway/types";
import { normalizeApplySafety } from "../lib/applySafety";
import { BUILTIN_DS } from "../config/deepseek";

export interface Settings {
  dsKey: string; // DeepSeek key(light/deep 均用)
  dsBaseUrl: string;
  modelFlash: string;
  modelPro: string;
  resume: string; // 用户简历全文 / 要点
  instruction: string; // 主控指令(CLAUDE.md 式),注入每次 AI 调用的 system 前缀
  targetJobs: string[]; // 用户确认的目标岗位关键词集合
  activeJob: string; // 当前用于定位的岗位(targetJobs 之一)
  jobHistory: string[]; // 历史选择过的岗位(最近优先,用于「历史选择」建议)
  cities: string[]; // 已选城市列表(label)
  city: string; // 当前城市(label,cities 之一,下游搜索用),码见 data/cities.ts
  salary: string; // 薪资档位筛选(label,空=不限),见 data/salaries.ts
  theme: "light" | "dark"; // 界面主题
  dailyCap: number; // 单日投递上限(防风控)
  delayMin: number; // 投递最小间隔(秒)
  delayMax: number; // 投递最大间隔(秒)
  workspaceDir: string; // 文件 agent 的求职工作区根目录
  sidebarWidth: number; // 右侧边栏宽度(可拖拽)
  feishuAppId: string; // 飞书自建应用 app_id
  feishuAppSecret: string; // 飞书自建应用 app_secret
  feishuBaseToken: string; // 多维表格 base_token
  feishuTableId: string; // 表 id
  feishuRedirectUri: string; // OAuth 重定向(需在飞书应用后台登记)
  feishuUserToken: string; // 飞书账号授权后的 user_access_token
  feishuRefreshToken: string; // 静默续期用(每次续期轮换)
  feishuTokenExpireAt: number; // user_access_token 过期时间(ms);0=未知(旧版授权)
  bridgeToken: string; // 与 BOSS 扩展约定的入站推送令牌(X-Copilot-Token)
  disclaimerAccepted: boolean; // 已确认首次免责声明
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
  dsBaseUrl: "https://api.deepseek.com/anthropic", // 绝对端点;桌面经 Rust 发出免 CORS,web dev 由客户端改写回 /api/ds 代理
  modelFlash: "deepseek-v4-flash",
  modelPro: "deepseek-v4-pro",
  resume: "",
  instruction: "",
  targetJobs: [],
  activeJob: "",
  jobHistory: [],
  cities: ["广州"],
  city: "广州",
  salary: "",
  theme: "light",
  dailyCap: 30,
  delayMin: 40,
  delayMax: 100,
  workspaceDir: "",
  sidebarWidth: 392,
  feishuAppId: "",
  feishuAppSecret: "",
  feishuBaseToken: "FWcdbn7uKaQrmcstVMUcc2UhnKC",
  feishuTableId: "tblUzqF9C2Leljof",
  feishuRedirectUri: "http://localhost:14520/feishu/callback",
  feishuUserToken: "",
  feishuRefreshToken: "",
  feishuTokenExpireAt: 0,
  bridgeToken: "",
  disclaimerAccepted: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * 旧版本 localStorage 迁移:把失效的 dev 代理 base_url 与不存在的模型名换成新默认,
 * 但保留用户已填的 dsKey。避免旧值掩盖 EXE 的网络修复。
 */
function migrate(s: Settings): Settings {
  const next = { ...s };
  // 仅修真正失效的 dev 代理 base_url;模型名尊重用户配置,不动。
  if (/\/api\/ds/.test(next.dsBaseUrl)) next.dsBaseUrl = DEFAULT_SETTINGS.dsBaseUrl;
  if (!Array.isArray(next.cities) || next.cities.length === 0)
    next.cities = next.city ? [next.city] : [...DEFAULT_SETTINGS.cities];
  if (!Array.isArray(next.jobHistory)) next.jobHistory = [];
  if (typeof next.salary !== "string") next.salary = "";
  if (next.bridgeToken === "job-copilot-local") next.bridgeToken = "";
  return { ...next, ...normalizeApplySafety(next) };
}

export function saveSettings(s: Settings): void {
  const normalized = { ...s, ...normalizeApplySafety(s) };
  localStorage.setItem(KEY, JSON.stringify(normalized));
}

/** 由 Settings 组装网关两档配置(均走 DeepSeek)。用户没填自己的 Key 时回退到内置公益 Key。 */
export function toGatewayConfig(s: Settings): GatewayConfig {
  const apiKey = s.dsKey || BUILTIN_DS.key;
  const baseUrl = s.dsBaseUrl || BUILTIN_DS.baseUrl;
  return {
    light: {
      baseUrl,
      apiKey,
      model: s.modelFlash,
      authStyle: "x-api-key",
    },
    deep: {
      baseUrl,
      apiKey,
      model: s.modelPro,
      authStyle: "x-api-key",
    },
  };
}
