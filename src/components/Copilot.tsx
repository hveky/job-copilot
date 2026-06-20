import { useEffect, useRef, useState } from "react";
import { chat, GatewayError } from "../gateway/client";
import type { ChatMessage, GatewayConfig } from "../gateway/types";
import { copilotSystem } from "../prompts/templates";

// 回复助手 lite(PRD §5.4):粘 HR 消息 → 出回复草稿。纯多轮 chat。
export function Copilot(props: {
  gateway: GatewayConfig;
  job: string;
  jd: string;
  resume: string;
  instruction: string;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9 });
  }, [msgs, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setErr("");
    setInput("");
    const next: ChatMessage[] = [...msgs, { role: "user", content: text }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      await chat(props.gateway, {
        tier: "light", // 回复助手默认走便宜的 DeepSeek Flash
        system: copilotSystem({
          job: props.job,
          jd: props.jd,
          resume: props.resume,
          instruction: props.instruction,
        }),
        messages: next,
        maxTokens: 1500,
        onDelta: (t) =>
          setMsgs((cur) => {
            const copy = [...cur];
            copy[copy.length - 1] = {
              role: "assistant",
              content: copy[copy.length - 1].content + t,
            };
            return copy;
          }),
      });
    } catch (e) {
      setErr(e instanceof GatewayError ? e.message : String(e));
      setMsgs((cur) => cur.slice(0, -1)); // 移除空的 assistant 占位
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="chat" ref={scrollRef}>
        {msgs.length === 0 && (
          <div className="hint" style={{ padding: 8 }}>
            把 HR 发来的消息贴进来,或直接问「怎么约面试时间 / 期望薪资怎么答」。
            我会给你一段可直接发出去的回复草稿。
            <br />
            <br />
            <span className="tier-pill">默认 DeepSeek Flash · 省</span>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={"msg " + m.role}>
            {m.content || (busy && i === msgs.length - 1 ? "思考中…" : "")}
            {m.role === "assistant" && m.content && (
              <div className="copy">
                <button
                  className="small ghost"
                  onClick={() => navigator.clipboard.writeText(m.content)}
                >
                  复制
                </button>
              </div>
            )}
          </div>
        ))}
        {err && <div className="err">{err}</div>}
      </div>
      <div className="composer">
        <textarea
          rows={3}
          value={input}
          placeholder="粘贴 HR 消息 / 提问……(Enter 发送,Shift+Enter 换行)"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="row">
          <button className="primary" disabled={busy} onClick={send}>
            {busy ? "生成中…" : "发送"}
          </button>
          {msgs.length > 0 && (
            <button className="ghost small" onClick={() => setMsgs([])}>
              清空
            </button>
          )}
        </div>
      </div>
    </>
  );
}
