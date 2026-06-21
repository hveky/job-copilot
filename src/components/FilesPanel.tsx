import { useEffect, useRef, useState } from "react";
import { chatToolsRaw } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import {
  fsList,
  fsRead,
  fsWrite,
  pickFolder,
} from "../lib/tauri";

const TOOLS = [
  {
    name: "list_files",
    description: "列出求职工作区里的所有文本文件(返回相对路径列表)",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_file",
    description: "读取一个文件的完整内容",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "相对路径" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "覆盖写入一个文件(会先让用户确认)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "新的完整文件内容" },
      },
      required: ["path", "content"],
    },
  },
];

function agentSystem(instruction: string): string {
  const base = [
    "你是求职文件助手,能列出/读取/修改用户本地求职工作区里的文件(简历、话术、JD 等)。",
    "用户让你改什么,先用 read_file 看清当前内容,再用 write_file 提交修改(会让用户确认后才真正落盘)。",
    "改简历/话术时:成果量化、用 STAR、不编造未确认技能。改完简要说明改了什么。",
  ].join("\n");
  return instruction.trim() ? `${instruction.trim()}\n\n---\n${base}` : base;
}

interface LogItem {
  kind: "user" | "assistant" | "tool";
  text: string;
}

export function FilesPanel(props: {
  gateway: GatewayConfig;
  workspaceDir: string;
  instruction: string;
  onSetWorkspace: (dir: string) => void;
}) {
  const root = props.workspaceDir;
  const [files, setFiles] = useState<string[]>([]);
  const [sel, setSel] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");

  // agent
  const [log, setLog] = useState<LogItem[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<{ path: string; content: string } | null>(
    null,
  );
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (root) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: 1e9 });
  }, [log, running]);

  async function chooseFolder() {
    setErr("");
    try {
      const dir = await pickFolder();
      if (dir) props.onSetWorkspace(dir);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function refresh() {
    setErr("");
    try {
      setFiles(await fsList(root));
    } catch (e) {
      setErr(String(e));
    }
  }

  async function openFile(p: string) {
    setErr("");
    try {
      setSel(p);
      setContent(await fsRead(root, p));
      setDirty(false);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function saveFile() {
    try {
      await fsWrite(root, sel, content);
      setDirty(false);
    } catch (e) {
      setErr(String(e));
    }
  }

  function confirmWrite(path: string, c: string): Promise<boolean> {
    setPending({ path, content: c });
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }
  function answerWrite(ok: boolean) {
    setPending(null);
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }

  async function runAgent() {
    const text = input.trim();
    if (!text || running) return;
    setInput("");
    setErr("");
    setLog((l) => [...l, { kind: "user", text }]);
    setRunning(true);
    const messages: any[] = [{ role: "user", content: text }];
    try {
      for (let step = 0; step < 8; step++) {
        const resp = await chatToolsRaw(props.gateway, "deep", {
          system: agentSystem(props.instruction),
          messages,
          tools: TOOLS,
          maxTokens: 4000,
        });
        const blocks: any[] = resp.content || [];
        messages.push({ role: "assistant", content: blocks });
        const textOut = blocks
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
        if (textOut) setLog((l) => [...l, { kind: "assistant", text: textOut }]);
        const toolUses = blocks.filter((b) => b.type === "tool_use");
        if (toolUses.length === 0) break;
        const results: any[] = [];
        for (const tu of toolUses) {
          let out = "";
          try {
            if (tu.name === "list_files") {
              out = (await fsList(root)).join("\n") || "(空)";
              setLog((l) => [...l, { kind: "tool", text: "📂 列出文件" }]);
            } else if (tu.name === "read_file") {
              out = await fsRead(root, tu.input.path);
              setLog((l) => [...l, { kind: "tool", text: "📄 读取 " + tu.input.path }]);
            } else if (tu.name === "write_file") {
              const ok = await confirmWrite(tu.input.path, tu.input.content);
              if (ok) {
                await fsWrite(root, tu.input.path, tu.input.content);
                out = "已写入 " + tu.input.path;
                setLog((l) => [...l, { kind: "tool", text: "✅ 写入 " + tu.input.path }]);
              } else {
                out = "用户拒绝了这次写入";
                setLog((l) => [...l, { kind: "tool", text: "✋ 拒绝写入 " + tu.input.path }]);
              }
            } else {
              out = "未知工具";
            }
          } catch (e) {
            out = "工具出错:" + String(e);
          }
          results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
        }
        messages.push({ role: "user", content: results });
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  }

  if (!root) {
    return (
      <div className="chat" style={{ justifyContent: "center" }}>
        <div className="hint" style={{ textAlign: "center" }}>
          选择你的求职工作区文件夹(resume / talk / jds 所在),
          <br />
          就能让 AI 直接帮你改简历话术。
          <br />
          <br />
          <button className="primary" onClick={chooseFolder}>
            选择文件夹
          </button>
          {err && <div className="err">{err}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <div className="row">
          <span className="hint" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={root}>
            {root}
          </span>
          <button className="small ghost" onClick={chooseFolder}>切换</button>
          <button className="small ghost" onClick={refresh}>刷新</button>
        </div>
      </div>

      <div style={{ maxHeight: 150, overflow: "auto", padding: 6, borderBottom: "1px solid var(--border)" }}>
        {files.length === 0 && <div className="hint" style={{ padding: 6 }}>无文本文件</div>}
        {files.map((f) => (
          <div
            key={f}
            className={"file-row" + (f === sel ? " active" : "")}
            onClick={() => openFile(f)}
          >
            {f}
          </div>
        ))}
      </div>

      {sel && (
        <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="hint" style={{ flex: 1 }}>{sel}</span>
            <button className="small primary" disabled={!dirty} onClick={saveFile}>
              {dirty ? "保存" : "已保存"}
            </button>
          </div>
          <textarea
            rows={6}
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          />
        </div>
      )}

      <div className="chat" ref={logRef} style={{ flex: 1 }}>
        {log.length === 0 && (
          <div className="hint" style={{ padding: 8 }}>
            让 AI 改文件,例如「把 resume 里 AI 方向版的自我介绍改得更突出开源作品」。
            AI 会读文件、提改动,写入前问你确认。
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={m.kind === "user" ? "msg user" : m.kind === "tool" ? "hint" : "msg assistant"}>
            {m.text}
          </div>
        ))}
        {running && <div className="hint">运行中…</div>}
        {err && <div className="err">{err}</div>}
      </div>

      {pending && (
        <div className="write-confirm">
          <div className="hint" style={{ marginBottom: 6 }}>
            AI 要写入 <strong>{pending.path}</strong>({pending.content.length} 字),确认?
          </div>
          <div className="content" style={{ maxHeight: 120, overflow: "auto", fontSize: 12, minHeight: 0 }}>
            {pending.content.slice(0, 600)}
            {pending.content.length > 600 ? "…" : ""}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button className="ghost small" onClick={() => answerWrite(false)}>拒绝</button>
            <button className="primary small" onClick={() => answerWrite(true)}>确认写入</button>
          </div>
        </div>
      )}

      <div className="composer">
        <textarea
          rows={2}
          value={input}
          placeholder="让 AI 改文件…(Enter 发送)"
          disabled={running}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              runAgent();
            }
          }}
        />
        <button className="primary" disabled={running} onClick={runAgent}>
          {running ? "运行中…" : "发送"}
        </button>
      </div>
    </div>
  );
}
