// 岗位定位:4 个预设(对应 CLAUDE.md 四赛道)降级为「快捷建议」,
// 用户可自定义任意岗位关键词。bias 给生成 prompt 注入侧重。
export interface JobPreset {
  label: string;
  bias: string;
}

export const JOB_PRESETS: JobPreset[] = [
  {
    label: "投流 / 运营",
    bias: "侧重广告投放(信息流/效果广告)、增长、ROI/ROAS、A/B 测试、素材与人群定向、数据复盘。",
  },
  {
    label: "Meta 跨境",
    bias: "侧重 Meta 广告(Facebook/Instagram)、跨境电商投放、海外人群与素材本地化、像素/事件追踪、出海增长。",
  },
  {
    label: "AI / Agent",
    bias: "侧重 AI 产品/Agent 开发、LLM 应用、开源作品、Prompt 工程、把懂增长+内容爆款作为差异化卖点。",
  },
  {
    label: "医药 CDM(科班对口)",
    bias: "侧重临床数据管理、CRF/EDC、数据清理与核查、医学术语、GCP/法规、中药学科班背景。",
  },
];

/** 取某个岗位的定位侧重:命中预设用其 bias,自定义则用通用模板。 */
export function biasForJob(job: string): string {
  const hit = JOB_PRESETS.find((p) => p.label === job);
  return hit ? hit.bias : `围绕「${job}」岗位的核心能力、关键词与行业要求。`;
}
