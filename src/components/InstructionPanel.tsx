import { useEffect, useRef, useState } from "react";
import { Sparkles, Square, Eye, Pencil, Check } from "lucide-react";
import { MarkdownView } from "./MarkdownView";
import { Button } from "../ui";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { instructionHelpSystem } from "../prompts/templates";

// 主控指令编辑器(CLAUDE.md 式):一段常驻文本,注入每次 AI 调用。支持预览/编辑 + AI 帮写。
export function InstructionPanel(props: {
  value: string;
  onChange: (v: string) => void;
  gateway: GatewayConfig;
  resume: string;
}) {
  const [draft, setDraft] = useState(props.value);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI 帮写
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setDraft(props.value), [props.value]);
  const dirty = draft !== props.value;

  function save() {
    props.onChange(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function generate() {
    const text = ask.trim();
    if (!text || busy) return;
    setErr("");
    setBusy(true);
    setEditing(true); // 切到编辑态,流式可见
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    try {
      await chat(props.gateway, {
        tier: "light",
        system: instructionHelpSystem(props.resume),
        messages: [{ role: "user", content: text }],
        maxTokens: 1200,
        signal: ac.signal,
        onDelta: (d) => {
          acc += d;
          setDraft(acc);
        },
      });
      if (!acc.trim()) setErr("生成结果为空,请换个说法重试。");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setErr(e instanceof GatewayError ? e.message : String(e));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div
      className="composer"
      style={{ flex: 1, borderTop: 0, gap: 10, minHeight: 0 }}
    >
      <div className="row">
        <span className="hint" style={{ flex: 1 }}>
          主控指令(相当于 CLAUDE.md)— 注入<strong>每一次</strong>生成与回复
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing((e) => !e)}
          icon={
            editing ? (
              <Eye size={14} strokeWidth={1.75} />
            ) : (
              <Pencil size={14} strokeWidth={1.75} />
            )
          }
        >
          {editing ? "预览" : "编辑"}
        </Button>
      </div>

      {/* AI 帮写:一句话诉求 → 展开成主控指令 */}
      <div className="row" style={{ gap: 6 }}>
        <input
          style={{ flex: 1 }}
          value={ask}
          placeholder="一句话说你的偏好,如「语气务实、成果量化、目标做 AI 产品」"
          disabled={busy}
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              generate();
            }
          }}
        />
        {busy ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => abortRef.current?.abort()}
            icon={<Square size={14} strokeWidth={1.75} />}
          >
            停止
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={generate}
            icon={<Sparkles size={14} strokeWidth={1.75} />}
            title="让 AI 帮你写主控指令"
          >
            AI 帮写
          </Button>
        )}
      </div>
      {busy && <div className="hint">✍️ 生成中…(会覆盖下方编辑框,生成后记得点保存)</div>}
      {err && <div className="err">{err}</div>}

      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <MarkdownView
          value={draft}
          editing={editing}
          onChange={setDraft}
          placeholder="写下你的偏好:语气、量化要求、不许声称的技能、目标赛道……(或用上方「AI 帮写」)"
        />
      </div>

      <div className="row">
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={save}
          icon={<Check size={16} strokeWidth={1.75} />}
        >
          {saved ? "已保存" : dirty ? "保存" : "已保存"}
        </Button>
        {dirty && <span className="hint">有未保存改动</span>}
      </div>
    </div>
  );
}
