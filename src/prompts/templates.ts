// Prompt 模板:B 线内容包生成 + 回复助手系统提示。
import type { Track } from "./tracks";

/** B 线:JD → 完整应试内容包(对应工作区五职责)。输出结构化 Markdown。 */
export function contentPackSystem(): string {
  return [
    "你是一名顶级求职教练 + 行业面试官。用户给你一段岗位 JD、目标赛道、和他的简历。",
    "你的任务是产出一份可直接拿去备战的「应试内容包」,中文,结构化 Markdown。",
    "务实、具体、可操作,拒绝空话套话。不要编造用户没有的经历;简历里没有的能力不要替他声称。",
  ].join("\n");
}

export function contentPackUser(args: {
  jd: string;
  track: Track;
  resume: string;
}): string {
  const resume = args.resume.trim()
    ? args.resume.trim()
    : "(用户暂未提供简历,简历针对性优化部分给出通用建议并标注【需补简历】)";
  return `# 目标赛道
${args.track.label} —— ${args.track.bias}

# 岗位 JD
${args.jd.trim()}

# 用户简历
${resume}

---
请严格按以下六个部分输出(每部分用二级标题 \`##\`):

## 1. JD 拆解
分三层:**硬性要求**(不满足直接挂)/ **加分项** / **隐藏信息**(从措辞反推团队规模、业务阶段、缺什么人)。

## 2. 应试知识包
按 \`必背概念\` / \`要理解的原理\` / \`八股高频题(附要点答案)\` 三级分类。

## 3. 必须动手的实操
区分「看懂就行」与「必须亲手跑否则一问露馅」,给出具体练手清单。

## 4. 面试准备
- 用 STAR 把简历里最相关的 1-2 个经历包装成可讲的故事;
- 一段 1–2 分钟的自我介绍话术(口语化、可直接背)。

## 5. 面试反问
5 条既显思考、又能帮用户判断要不要去的反问。

## 6. 简历针对性优化
针对这份 JD 命中关键词。给 **改前 / 改后 对比 + 理由**,不直接覆盖原稿。`;
}

/** 回复助手 lite:帮用户回复 HR。 */
export function copilotSystem(ctx: {
  track?: Track;
  jd?: string;
  resume?: string;
}): string {
  const lines = [
    "你是求职沟通助手,帮用户在 BOSS 直聘上回复 HR 的消息。",
    "用户会把 HR 发来的消息贴给你,或直接问怎么处理某个沟通场景(约面试时间、谈薪资、回答 HR 提问等)。",
    "你的输出:一段可以直接发出去的中文回复草稿,礼貌、专业、不卑不亢、简洁。必要时先一句简短说明再给草稿。",
    "不要替用户编造他没有的经历或承诺无法兑现的事。",
  ];
  if (ctx.track) lines.push(`\n当前目标赛道:${ctx.track.label}(${ctx.track.bias})`);
  if (ctx.jd?.trim()) lines.push(`\n当前岗位 JD 摘要:\n${ctx.jd.trim().slice(0, 1200)}`);
  if (ctx.resume?.trim())
    lines.push(`\n用户简历要点:\n${ctx.resume.trim().slice(0, 1200)}`);
  return lines.join("\n");
}
