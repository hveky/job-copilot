import { useRef, useState } from "react";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig, Tier } from "../gateway/types";
import { contentPackSystem, contentPackUser } from "../prompts/templates";
import { MarkdownView } from "./MarkdownView";

export function ContentPanel(props: {
  gateway: GatewayConfig;
  job: string;
  city: string;
  jd: string;
  onJdChange: (jd: string) => void;
  resume: string;
  instruction: string;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [tier, setTier] = useState<Tier>("deep");
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!props.jd.trim()) {
      setErr("请先粘贴岗位 JD。");
      return;
    }
    setErr("");
    setContent("");
    setReasoning(false);
    setEditing(false);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await chat(props.gateway, {
        tier,
        system: contentPackSystem(props.instruction),
        messages: [
          {
            role: "user",
            content: contentPackUser({
              jd: props.jd,
              job: props.job || "(未指定,请从 JD 自行判断)",
              city: props.city,
              resume: props.resume,
            }),
          },
        ],
        maxTokens: 8000,
        signal: ac.signal,
        onThinking: () => setReasoning(true),
        onDelta: (t) => {
          setReasoning(false);
          setContent((c) => c + t);
        },
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        /* 用户取消 */
      } else {
        setErr(e instanceof GatewayError ? e.message : String(e));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function copy() {
    navigator.clipboard.writeText(content);
  }

  function download() {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `内容包-${props.job || "JD"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="card">
        <h3>② 粘贴岗位 JD</h3>
        <textarea
          rows={7}
          value={props.jd}
          placeholder="把 BOSS / 招聘网站上的岗位 JD 整段粘进来……（桌面版将支持自动抓取）"
          onChange={(e) => props.onJdChange(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="primary"
            disabled={busy}
            onClick={generate}
            title="生成应试内容包"
          >
            {busy ? "生成中…" : "③ 一键生成内容包"}
          </button>
          {busy && (
            <button className="ghost small" onClick={stop}>
              停止
            </button>
          )}
          <span className="spacer" style={{ flex: 1 }} />
          <span className="hint">档位</span>
          <select
            value={tier}
            style={{ width: 180 }}
            onChange={(e) => setTier(e.target.value as Tier)}
          >
            <option value="light">轻(DeepSeek Flash · 快省)</option>
            <option value="deep">深度(DeepSeek Pro · 推荐)</option>
          </select>
        </div>
        {err && <div className="err">{err}</div>}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>内容包</h3>
          {content && (
            <div className="row">
              <button
                className="small ghost"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "预览" : "编辑"}
              </button>
              <button className="small ghost" onClick={copy}>
                复制
              </button>
              <button className="small ghost" onClick={download}>
                导出 .md
              </button>
            </div>
          )}
        </div>
        {busy && !content && (
          <div className="hint" style={{ marginTop: 10 }}>
            {reasoning ? "🧠 模型推理中…(深度档会先思考再下笔)" : "连接中…"}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <MarkdownView
            value={content}
            editing={editing}
            onChange={setContent}
            placeholder="生成的【JD拆解 / 知识包 / 实操 / 面试准备 / 反问 / 简历针对性优化】会出现在这里,可预览可编辑可导出。"
          />
        </div>
      </div>
    </div>
  );
}
