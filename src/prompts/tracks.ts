// 四套投递赛道(对应 CLAUDE.md 用户情况)。bias 用于给生成 prompt 注入赛道侧重。
export interface Track {
  id: string;
  label: string;
  bias: string;
}

export const TRACKS: Track[] = [
  {
    id: "touliu",
    label: "投流 / 运营",
    bias: "侧重广告投放(信息流/效果广告)、增长、ROI/ROAS、A/B 测试、素材与人群定向、数据复盘。",
  },
  {
    id: "meta",
    label: "Meta 跨境",
    bias: "侧重 Meta 广告(Facebook/Instagram)、跨境电商投放、海外人群与素材本地化、像素/事件追踪、出海增长。",
  },
  {
    id: "ai",
    label: "AI / Agent",
    bias: "侧重 AI 产品/Agent 开发、LLM 应用、开源作品、Prompt 工程、把懂增长+内容爆款作为差异化卖点。",
  },
  {
    id: "cdm",
    label: "医药 CDM(科班对口)",
    bias: "侧重临床数据管理、CRF/EDC、数据清理与核查、医学术语、GCP/法规、中药学科班背景。",
  },
];

export function trackById(id: string): Track {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
