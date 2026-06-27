// Prompt 模板:B 线内容包生成 + 回复助手系统提示 + AI 荐岗。
import { biasForJob } from "./tracks";

/**
 * 隐藏的系统级默认指令:始终注入每次 AI 调用,用户看不到也不能改。
 * 给模型交代工作区结构与总目标。
 */
export const SYSTEM_DEFAULT_INSTRUCTION = [
  "工作区文件树固定为四个文件夹:preps(应试内容包)、talk(话术与 HR 常见问题应对/反问)、jds(岗位 JD)、resumes(简历)。",
  "你的任务是帮助用户找到工作。",
].join("\n");

/** 把系统默认 + 用户主控指令拼到 system 最前面(CLAUDE.md 式注入)。 */
export function withInstruction(
  instruction: string | undefined,
  base: string,
): string {
  const ins = instruction?.trim();
  const head = ins
    ? `${SYSTEM_DEFAULT_INSTRUCTION}\n\n${ins}`
    : SYSTEM_DEFAULT_INSTRUCTION;
  return `${head}\n\n---\n${base}`;
}

/** B 线:JD → 完整应试内容包(对应工作区五职责)。输出结构化 Markdown。 */
export function contentPackSystem(instruction?: string): string {
  return withInstruction(
    instruction,
    [
      "你是一名顶级求职教练 + 行业面试官。用户给你一段岗位 JD、目标赛道、和他的简历。",
      "你的任务是产出一份可直接拿去备战的「应试内容包」,中文,结构化 Markdown。",
      "务实、具体、可操作,拒绝空话套话。不要编造用户没有的经历;简历里没有的能力不要替他声称。",
    ].join("\n"),
  );
}

export function contentPackUser(args: {
  jd: string;
  job: string;
  city?: string;
  resume: string;
}): string {
  const resume = args.resume.trim()
    ? args.resume.trim()
    : "(用户暂未提供简历,简历针对性优化部分给出通用建议并标注【需补简历】)";
  const city = args.city?.trim() ? `\n# 目标城市\n${args.city.trim()}` : "";
  return `# 目标岗位
${args.job} —— ${biasForJob(args.job)}${city}

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

/** Instruction「AI 帮写」:把用户一句话诉求展开成一段 CLAUDE.md 式主控指令。 */
export function instructionHelpSystem(resume?: string): string {
  const lines = [
    "你帮用户把零散的求职偏好/诉求,整理成一段可直接用的「主控指令」(相当于 CLAUDE.md),",
    "这段指令之后会注入到每一次简历优化、内容包生成、HR 回复里,作为贯穿全程的偏好。",
    "用中文、Markdown 要点(`- ` 列表),覆盖这些维度(用户没提到的合理留空,不要硬编):",
    "  · 语气与风格(务实/正式/亲和…)",
    "  · 成果量化与 STAR 包装要求",
    "  · 目标赛道 / 岗位方向",
    "  · ⚠️ 绝不能替用户声称的、未确认的技能(让模型不要编造)",
    "  · 简历改写偏好(如:给改前/改后+理由,不直接覆盖原稿)",
    "务实、具体、可直接落地,拒绝空话套话。只输出指令正文本身,不要解释、不要前后缀、不要代码块包裹。",
  ];
  if (resume?.trim()) {
    lines.push(
      `\n用户简历(供你贴合其真实背景,不要照抄进指令):\n${resume.trim().slice(0, 1500)}`,
    );
  }
  return lines.join("\n");
}

/** 回复助手 lite:帮用户回复 HR。 */
export function copilotSystem(ctx: {
  job?: string;
  jd?: string;
  resume?: string;
  instruction?: string;
}): string {
  const lines = [
    "你是求职沟通助手,帮用户在 BOSS 直聘上回复 HR 的消息。",
    "用户会把 HR 发来的消息贴给你,或直接问怎么处理某个沟通场景(约面试时间、谈薪资、回答 HR 提问等)。",
    "你的输出:一段可以直接发出去的中文回复草稿,礼貌、专业、不卑不亢、简洁。必要时先一句简短说明再给草稿。",
    "不要替用户编造他没有的经历或承诺无法兑现的事。",
  ];
  if (ctx.job) lines.push(`\n当前目标岗位:${ctx.job}(${biasForJob(ctx.job)})`);
  if (ctx.jd?.trim()) lines.push(`\n当前岗位 JD 摘要:\n${ctx.jd.trim().slice(0, 1200)}`);
  if (ctx.resume?.trim())
    lines.push(`\n用户简历要点:\n${ctx.resume.trim().slice(0, 1200)}`);
  return withInstruction(ctx.instruction, lines.join("\n"));
}

/** AI 荐岗:据简历 + 用户补充,产出强相关岗位关键词。 */
export function recommendSystem(): string {
  return [
    "你是资深求职顾问。根据用户简历和补充诉求,推荐 5-8 个与他最强相关、且市场在招的岗位关键词。",
    "只输出岗位关键词本身(BOSS 直聘上能直接搜的那种,如「AI产品经理」「信息流优化师」),每行一个,不要编号、不要解释、不要多余文字。",
  ].join("\n");
}

export function recommendUser(args: { resume: string; wish?: string }): string {
  const resume = args.resume.trim() || "(简历为空,请基于下面的补充诉求推荐)";
  const wish = args.wish?.trim()
    ? `\n\n# 用户补充诉求\n${args.wish.trim()}`
    : "";
  return `# 用户简历\n${resume}${wish}`;
}

/** BOSS 追发的定制招呼语(打招呼后第一句自我介绍)。 */
export function greetingSystem(instruction?: string): string {
  return withInstruction(
    instruction,
    [
      "你以求职者本人口吻,写一段在 BOSS 直聘上追发给 HR 的开场自我介绍。",
      "要求:1-2 句,简洁凝练、开门见山,第一句就抛出最硬的价值——我做过什么、能做什么、具备哪些直接匹配这个岗位的能力。",
      "自信、有锐度,适度拔高个人画像、带点自我营销的冲劲,让 HR 眼前一亮、愿意聊。",
      "禁止:「您好」「我看到贵公司」「虽然…但是…」这类客套、铺垫、转折和闲聊;不要谦辞,不要解释求职动机。",
      "紧扣岗位 JD 的核心要求命中,尽量用数字/成果说话。可直接发送,只输出这段话本身,不要引号或解释。",
      "不要虚构简历里没有的具体证书、职级或经历;但措辞可以自信有底气地呈现已有亮点。",
    ].join("\n"),
  );
}

export function resumeExtractSystem(): string {
  return [
    "你把用户的简历文本抽取成严格 JSON,字段:",
    '{ "basics":{"name","headline","phone","email","location","summary"}, "experience":[{"company","role","start","end","bullets":[]}], "education":[{"school","degree","major","start","end"}], "skills":[], "projects":[{"name","desc"}], "links":[{"label","url"}] }',
    "缺失的字段填空字符串或空数组。bullets 是该段经历的要点数组。只输出 JSON 本体,不要任何解释、不要 markdown 代码围栏。",
  ].join("\n");
}

export function greetingUser(args: {
  job: string;
  jd: string;
  resume: string;
}): string {
  const resume = args.resume.trim() || "(简历为空,请基于岗位写通用但真诚的开场白)";
  return `# 目标岗位\n${args.job} —— ${biasForJob(args.job)}\n\n# 岗位 JD\n${args.jd.trim()}\n\n# 我的简历\n${resume}`;
}
