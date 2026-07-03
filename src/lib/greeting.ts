// 招呼语共享生成引擎:结构化生成(先选亮点再写)+ 落地校验 + 违规自动重写一次。
// ApplyModal / BatchApplyModal 共用,消除重复逻辑。
import { chat } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import {
  greetingRewriteSystem,
  greetingSystem,
  greetingUser,
} from "../prompts/templates";

// 客套/铺垫黑名单:出现即判违规,触发重写。
const BANNED = ["您好", "你好", "冒昧", "打扰您", "久仰", "我看到贵公司", "虽然"];
const MAX_LEN = 140; // 中文字符上限

/** 校验招呼语是否合格,合格返回 null,否则返回违规原因。 */
export function validateGreeting(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return "空内容";
  // 兜底防线:未解析成功的 JSON 残片绝不能当招呼语发出
  if (/^[{[]/.test(t) || t.includes('"greeting"')) return "疑似未解析的 JSON";
  for (const w of BANNED) if (t.includes(w)) return `含禁用表述「${w}」`;
  if (t.length > MAX_LEN) return `过长(${t.length}字,上限${MAX_LEN})`;
  const sentences = (t.match(/[。！？!?]/g) || []).length;
  if (sentences >= 4) return "句子过多(应 1-2 句)";
  return null;
}

/** 防御式解析结构化 JSON,取 greeting;失败则尽力捞出 greeting 字段,再退回整段。 */
function parseGreeting(raw: string): string {
  let s = (raw || "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const o = JSON.parse(m[0]);
      if (o && typeof o.greeting === "string" && o.greeting.trim()) {
        return o.greeting.trim();
      }
    } catch {
      /* JSON 坏了,下面用正则捞 greeting */
    }
  }
  // JSON 解析失败:尽力从残片里捞出 "greeting":"..." 的值(处理转义引号)
  const g = s.match(/"greeting"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (g) return g[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
  return s;
}

export interface GreetingArgs {
  jobLabel: string;
  jd: string;
  resume: string;
  instruction?: string;
  signal?: AbortSignal;
}

/**
 * 生成一条合格招呼语:
 * 1) 结构化生成(先从简历选命中 JD 的硬亮点,再写 greeting);
 * 2) 本地校验,违规则带原因重写一次;
 * 3) 仍不过则取更短的一版(短的通常更贴"1-2句"要求)。
 */
export async function generateGreeting(
  gateway: GatewayConfig,
  args: GreetingArgs,
): Promise<string> {
  const user = greetingUser({
    job: args.jobLabel,
    jd: args.jd,
    resume: args.resume,
  });

  const first = parseGreeting(
    await chat(gateway, {
      tier: "light",
      system: greetingSystem(args.instruction),
      messages: [{ role: "user", content: user }],
      maxTokens: 600,
      signal: args.signal,
    }),
  );

  const reason = validateGreeting(first);
  if (!reason) return first;

  const second = parseGreeting(
    await chat(gateway, {
      tier: "light",
      system: greetingRewriteSystem(reason, args.instruction),
      messages: [
        { role: "user", content: `${user}\n\n# 上一版(违规:${reason})\n${first}` },
      ],
      maxTokens: 600,
      signal: args.signal,
    }),
  );

  if (!validateGreeting(second)) return second;
  // 两版都仍不合格(边缘情况):不再重试,取更短的一版作 best-effort 返回,
  // 由调用方展示给用户人工审核/改后再发(不会静默发出违规内容)。
  return second.trim().length <= first.trim().length ? second : first;
}
