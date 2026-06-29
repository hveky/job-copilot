import { useMemo, useState } from "react";
import {
  ClipboardCopy,
  FileText,
  MessageSquareText,
  Save,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button, Tabs, type TabItem } from "../ui";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { copilotSystem } from "../prompts/templates";

type Tone = "professional" | "active" | "calm" | "rights";

const TONES: TabItem<Tone>[] = [
  { key: "professional", label: "专业" },
  { key: "active", label: "积极" },
  { key: "calm", label: "克制" },
  { key: "rights", label: "争取权益" },
];

const QUICK_MESSAGES = ["面试时间怎么约", "期望薪资怎么答", "问岗位细节", "婉拒但留机会"];

function toneLabel(tone: Tone) {
  return TONES.find((t) => t.key === tone)?.label ?? "专业";
}

function inferIntent(text: string) {
  if (!text.trim()) return "等待粘贴 HR 消息";
  if (/薪|工资|预算|package|待遇/i.test(text)) return "薪资沟通";
  if (/面试|时间|几点|日程|约/i.test(text)) return "面试排期";
  if (/岗位|职责|团队|业务|base|地点/i.test(text)) return "岗位信息确认";
  return "常规沟通回复";
}

function riskTips(text: string) {
  if (!text.trim()) return ["先贴入 HR 原话，系统会结合 JD、简历和主控指令生成回复。"];
  const tips = ["先确认对方问题，再给明确可执行的下一步。"];
  if (/薪|工资|预算|待遇/i.test(text)) tips.push("薪资问题避免过早报死，可给区间和依据。 ");
  if (/面试|时间|几点|日程/i.test(text)) tips.push("时间回复建议给 2-3 个可选窗口，降低来回沟通。 ");
  if (!text.includes("? ") && !text.includes("？")) tips.push("如果 HR 表述不完整，回复里补一个澄清问题。 ");
  return tips.slice(0, 3);
}

export function ReplyWorkspace(props: {
  gateway: GatewayConfig;
  job: string;
  jd: string;
  resume: string;
  instruction: string;
}) {
  const [hrMessage, setHrMessage] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [replyDraft, setReplyDraft] = useState("");
  const [savedSnippets, setSavedSnippets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const intent = useMemo(() => inferIntent(hrMessage), [hrMessage]);
  const tips = useMemo(() => riskTips(hrMessage), [hrMessage]);
  const contextReady = props.job || props.jd || props.resume;

  async function generate() {
    const text = hrMessage.trim();
    if (!text || busy) return;
    setErr("");
    setReplyDraft("");
    setBusy(true);
    try {
      await chat(props.gateway, {
        tier: "light",
        system: copilotSystem({
          job: props.job,
          jd: props.jd,
          resume: props.resume,
          instruction: props.instruction,
        }),
        messages: [
          {
            role: "user",
            content:
              `请根据下面 HR 消息生成一段可直接发送的中文回复。\n` +
              `语气: ${toneLabel(tone)}。\n` +
              `要求: 先给自然回复正文，不要标题；语气真实、简洁、可直接复制；必要时给出 2-3 个可选时间或薪资区间表达。\n\n` +
              `HR 消息:\n${text}`,
          },
        ],
        maxTokens: 1200,
        onDelta: (t) => setReplyDraft((cur) => cur + t),
      });
    } catch (e) {
      setErr(e instanceof GatewayError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function saveSnippet() {
    const text = replyDraft.trim();
    if (!text) return;
    setSavedSnippets((cur) => [text, ...cur.filter((x) => x !== text)].slice(0, 4));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="border-b border-border bg-surface-3 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
          <MessageSquareText size={17} strokeWidth={1.75} className="text-accent-strong" />
          HR 回复工作台
        </div>
        <p className="mt-1 mb-0 text-aux text-text-2">
          粘贴 HR 原话，按意图判断、回复策略和语气生成可直接发送的草稿。
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid gap-3">
          <section className="rounded border border-border bg-surface p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="m-0 text-card-title text-text">HR 消息解析</h3>
              <span className="rounded-full bg-ai-soft px-2.5 py-1 text-[11px] font-medium text-ai">
                {contextReady ? "已带入上下文" : "等待上下文"}
              </span>
            </div>
            <textarea
              rows={5}
              value={hrMessage}
              placeholder="粘贴 HR 消息，例如：方便明天下午聊一下吗？期望薪资是多少？"
              onChange={(e) => setHrMessage(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_MESSAGES.map((q) => (
                <button key={q} className="small ghost" onClick={() => setHrMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 2xl:grid-cols-2">
            <div className="rounded border border-[color-mix(in_srgb,var(--ai)_22%,transparent)] bg-ai-soft p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                <Sparkles size={16} strokeWidth={1.75} className="text-ai" />
                意图判断
              </div>
              <p className="mt-2 mb-0 text-[18px] font-bold text-text">{intent}</p>
              <p className="mt-1 mb-0 text-aux text-text-2">
                当前草稿会优先处理对方最可能关心的问题，再补充下一步动作。
              </p>
            </div>
            <div className="rounded border border-border bg-surface-3 p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                <Wand2 size={16} strokeWidth={1.75} className="text-accent-strong" />
                回复策略
              </div>
              <ul className="mt-2 mb-0 list-disc space-y-1 pl-5 text-aux text-text-2">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded border border-border bg-surface p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-card-title text-text">生成回复草稿</h3>
              <Tabs items={TONES} active={tone} onChange={setTone} variant="segmented" />
            </div>
            <textarea
              rows={8}
              value={replyDraft}
              placeholder={busy ? "生成中..." : "生成后的回复会出现在这里，也可以手动润色。"}
              onChange={(e) => setReplyDraft(e.target.value)}
            />
            {err && <div className="err">{err}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                loading={busy}
                onClick={generate}
                icon={<Send size={16} strokeWidth={1.75} />}
              >
                {busy ? "生成中..." : "生成回复草稿"}
              </Button>
              <Button
                variant="ghost"
                disabled={!replyDraft.trim()}
                onClick={() => navigator.clipboard.writeText(replyDraft)}
                icon={<ClipboardCopy size={16} strokeWidth={1.75} />}
              >
                复制
              </Button>
              <Button
                variant="ghost"
                disabled={!replyDraft.trim()}
                onClick={saveSnippet}
                icon={<Save size={16} strokeWidth={1.75} />}
              >
                保存话术
              </Button>
            </div>
          </section>

          <section className="rounded border border-border bg-surface-3 p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-text">
              <FileText size={16} strokeWidth={1.75} className="text-accent-strong" />
              上下文摘要
            </div>
            <div className="grid gap-2 text-aux text-text-2">
              <p className="m-0"><strong className="text-text">目标岗位：</strong>{props.job || "未选择"}</p>
              <p className="m-0"><strong className="text-text">JD 状态：</strong>{props.jd ? "已带入当前 JD" : "未粘贴 JD"}</p>
              <p className="m-0"><strong className="text-text">简历状态：</strong>{props.resume ? "已读取简历" : "未读取简历"}</p>
            </div>
            {savedSnippets.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="mb-2 text-[12px] font-semibold text-text-2">常用话术</div>
                <div className="grid gap-2">
                  {savedSnippets.map((s, i) => (
                    <button
                      key={i}
                      className="ghost text-left text-aux leading-[18px]"
                      onClick={() => setReplyDraft(s)}
                    >
                      {s.slice(0, 58)}{s.length > 58 ? "..." : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
