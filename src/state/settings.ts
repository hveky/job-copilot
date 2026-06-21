// 本地设置(localStorage)。M1 阶段 key 存浏览器;包入 Tauri 后迁到系统安全存储 + Rust。
import type { GatewayConfig } from "../gateway/types";

export interface Settings {
  dsKey: string; // DeepSeek key(light/deep 均用)
  dsBaseUrl: string;
  modelFlash: string;
  modelPro: string;
  resume: string; // 用户简历全文 / 要点
  instruction: string; // 主控指令(CLAUDE.md 式),注入每次 AI 调用的 system 前缀
  targetJobs: string[]; // 用户确认的目标岗位关键词集合
  activeJob: string; // 当前用于定位的岗位(targetJobs 之一)
  city: string; // 选中城市(label),码见 data/cities.ts
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
  dsBaseUrl: "/api/ds/anthropic", // dev 代理 → api.deepseek.com/anthropic
  modelFlash: "deepseek-v4-flash",
  modelPro: "deepseek-v4-pro",
  resume: "",
  instruction: DEFAULT_INSTRUCTION,
  targetJobs: ["AI / Agent"],
  activeJob: "AI / Agent",
  city: "广州",
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

/** 由 Settings 组装网关两档配置(均走 DeepSeek)。 */
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
  };
}
