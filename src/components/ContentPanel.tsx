import { useRef, useState } from "react";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig, Tier } from "../gateway/types";
import { contentPackSystem, contentPackUser } from "../prompts/templates";
import { fsWrite } from "../lib/tauri";

/** 生成的内容包文件名:preps/<岗位|JD>-<时间戳>.md(去掉路径非法字符)。 */
function packPath(job: string): string {
  const safe = (job || "JD").replace(/[\\/:*?"<>|]/g, "").slice(0, 40) || "JD";
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `preps/${safe}-${stamp}.md`;
}

export function ContentPanel(props: {
  gateway: GatewayConfig;
  job: string;
  city: string;
  jd: string;
  onJdChange: (jd: string) => void;
  resume: string;
  instruction: string;
  root: string;
  onGenerated: (path: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const [err, setErr] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [tier, setTier] = useState<Tier>("deep");
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!props.jd.trim()) {
      setErr("请先粘贴岗位 JD。");
      return;
    }
    if (!props.root) {
      setErr("数据目录尚未就绪(桌面版才能生成到文件)。");
      return;
    }
    setErr("");
    setSavedPath("");
    setReasoning(false);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    let content = "";
    try {
      content = await chat(props.gateway, {
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
        onDelta: () => setReasoning(false),
      });
      if (content.trim()) {
        const path = packPath(props.job);
        await fsWrite(props.root, path, content);
        setSavedPath(path);
        props.onGenerated(path);
      } else {
        setErr("生成结果为空,请重试或换个档位。");
      }
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

  return (
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
          title="生成应试内容包并写入 preps 文件夹"
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
      {busy && (
        <div className="hint" style={{ marginTop: 10 }}>
          {reasoning
            ? "🧠 模型推理中…(深度档会先思考再下笔)"
            : "生成中,完成后会写入 preps 文件夹并自动打开…"}
        </div>
      )}
      {savedPath && (
        <div className="hint" style={{ marginTop: 10 }}>
          ✅ 已生成 →{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              props.onGenerated(savedPath);
            }}
          >
            {savedPath}
          </a>
          (在右侧「文件」面板查看 / 编辑)
        </div>
      )}
      {err && <div className="err">{err}</div>}
    </div>
  );
}
