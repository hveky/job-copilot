export type ScoreLevel = "高匹配" | "中匹配" | "低匹配";
export type ScoreStatus = "pending" | "scoring" | "scored" | "failed";

export interface ScorePromptInput {
  target: string;
  city: string;
  salary: string;
  resume: string;
  title: string;
  company: string;
  jobCity?: string;
  salaryText: string;
  tags: string;
  jd?: string;
}

export interface ParsedScore {
  score: number;
  level: ScoreLevel;
  reason: string;
  highlights: string[];
  risks: string[];
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function levelFromScore(score: number): ScoreLevel {
  if (score >= 80) return "高匹配";
  if (score >= 70) return "中匹配";
  return "低匹配";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean).slice(0, 5);
}

export function parseScoreResponse(raw: string): ParsedScore {
  const text = raw.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      const score = clampScore(parsed.score);
      return {
        score,
        level: (typeof parsed.level === "string" && /高匹配|中匹配|低匹配/.test(parsed.level)
          ? parsed.level
          : levelFromScore(score)) as ScoreLevel,
        reason: String(parsed.reason || "AI 已完成匹配分析").trim(),
        highlights: stringArray(parsed.highlights),
        risks: stringArray(parsed.risks),
      };
    } catch {
      /* fall through */
    }
  }

  const [scoreRaw, ...reasonParts] = text.split("|");
  const score = clampScore(scoreRaw);
  const reason = reasonParts.join("|").trim() || text.replace(scoreRaw, "").trim() || "AI 已完成匹配分析";
  return { score, level: levelFromScore(score), reason, highlights: [], risks: [] };
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，。；;、/|｜·:：()（）【】\[\]\-]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
}

export function inferDirection(title: string, tags = ""): string {
  const text = `${title} ${tags}`.toLowerCase();
  if (/meta|facebook|instagram|投放|广告|增长|优化师|千川|巨量|sem|信息流/.test(text)) return "投流/增长";
  if (/ai|aigc|agent|智能体|产品经理|大模型|算法|prompt|saas/.test(text)) return "AI/Agent";
  if (/医药|药企|cdm|临床|注册|药学|cro|cra|crc/.test(text)) return "医药/CDM";
  if (/跨境|shopify|amazon|亚马逊|独立站|dtc|出海/.test(text)) return "跨境电商";
  if (/运营|社群|内容|新媒体|用户/.test(text)) return "运营";
  return "待判断";
}

export function ruleFallbackScore(input: ScorePromptInput): ParsedScore {
  const targetWords = new Set(words(input.target));
  const jobWords = new Set(words(`${input.title} ${input.tags} ${input.jd || ""}`));
  let score = 50;
  let overlap = 0;
  targetWords.forEach((w) => {
    if (jobWords.has(w)) overlap += 1;
  });
  score += Math.min(20, overlap * 8);

  const resumeText = input.resume.toLowerCase();
  const jobText = `${input.title} ${input.tags} ${input.jd || ""}`.toLowerCase();
  for (const kw of ["meta", "投放", "运营", "ai", "agent", "医药", "cdm", "跨境"]) {
    if (resumeText.includes(kw) && jobText.includes(kw)) score += 5;
  }
  if (input.city && input.jobCity && input.city === input.jobCity) score += 8;
  if (!input.salary || input.salary === "不限") score += 3;
  if (/本科|大专|应届|1-3年|经验不限/.test(input.tags)) score += 5;

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    level: levelFromScore(finalScore),
    reason: "规则兜底：按目标关键词、简历证据、城市薪资和经验学历估算",
    highlights: overlap > 0 ? ["岗位目标存在关键词重合"] : [],
    risks: finalScore < 70 ? ["AI 评分失败，建议人工复核"] : [],
  };
}

export function buildScorePrompt(input: ScorePromptInput): string {
  return `请基于以下资料为候选岗位做匹配评分。必须只返回 JSON，不要 Markdown。

评分维度固定为：
1. 岗位目标匹配：目标岗位与岗位标题/JD 的一致度。
2. 简历证据：简历中是否有可支撑该岗位的项目、成果、技能证据。
3. 薪资城市：岗位城市、区域、薪资是否符合当前筛选。
4. 经验学历：经验年限、学历、应届/社招要求是否匹配。
5. 赛道相关性：投流/增长、跨境电商、AI/Agent、医药/CDM 等赛道是否相关。

输出 JSON schema：
{"score":0-100整数,"level":"高匹配|中匹配|低匹配","reason":"80-140字的分句说明","highlights":["亮点"],"risks":["风险"]}

reason 写作要求（必须做到）：
- 80-140 个中文字符，分 2-3 句。
- 第一句：点明最契合的 1-2 个评分维度，并引用简历或 JD 中的具体词/成果作为证据（不要空话）。
- 第二句：指出主要短板或风险（经验/学历/城市/薪资/赛道任一）。
- 第三句：给一句明确的投递建议（如「建议优先投递」「可投但需补充XX」「不建议」）。
highlights 与 risks 各给 1-3 条具体的点（引用真实信息，不要泛泛而谈）。

当前目标：${input.target || "未设置"}
当前城市：${input.city || "不限"}
薪资筛选：${input.salary || "不限"}
简历摘要：${input.resume.slice(0, 1600)}

岗位标题：${input.title}
公司：${input.company}
岗位城市：${input.jobCity || "未知"}
薪资：${input.salaryText || "未知"}
标签：${input.tags || "无"}
JD：${(input.jd || "").slice(0, 1800)}`;
}

export async function runLimitedQueue<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}
