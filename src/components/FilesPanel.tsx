import { useEffect, useRef, useState } from "react";
import { chatToolsRaw } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { fsList, fsRead, fsWrite } from "../lib/tauri";
import { MarkdownView } from "./MarkdownView";
import { renderMd } from "../lib/markdown";
import { SYSTEM_DEFAULT_INSTRUCTION } from "../prompts/templates";

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
  const head = instruction.trim()
    ? `${SYSTEM_DEFAULT_INSTRUCTION}\n\n${instruction.trim()}`
    : SYSTEM_DEFAULT_INSTRUCTION;
  return `${head}\n\n---\n${base}`;
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let cur = root;
    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;
      let child = cur.children.find((c) => c.name === part && c.isFile === isFile);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, idx + 1).join("/"),
          isFile,
          children: [],
        };
        cur.children.push(child);
      }
      cur = child;
    });
  }
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) =>
      a.isFile !== b.isFile ? (a.isFile ? 1 : -1) : a.name.localeCompare(b.name),
    );
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

interface LogItem {
  kind: "user" | "assistant" | "tool";
  text: string;
}

export function FilesPanel(props: {
  gateway: GatewayConfig;
  root: string;
  instruction: string;
  fileToOpen?: string;
  onFileOpened?: () => void;
  onFilesChanged?: () => void;
}) {
  const root = props.root;
  const [files, setFiles] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [fileEditing, setFileEditing] = useState(true);
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

  // 上下分区高度(可拖拽)
  const bodyRef = useRef<HTMLDivElement>(null);
  const [topH, setTopH] = useState(280);

  useEffect(() => {
    if (root) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: 1e9 });
  }, [log, running]);
  // 外部请求打开某文件(如内容包生成后跳转)
  useEffect(() => {
    if (!props.fileToOpen || !root) return;
    (async () => {
      await refresh();
      await openFile(props.fileToOpen!);
      props.onFileOpened?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fileToOpen, root]);

  async function refresh() {
    setErr("");
    try {
      const list = await fsList(root);
      setFiles(list);
      // 默认展开顶层文件夹
      const top = new Set<string>();
      list.forEach((p) => {
        const i = p.indexOf("/");
        if (i > 0) top.add(p.slice(0, i));
      });
      setExpanded(top);
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
      props.onFilesChanged?.();
    } catch (e) {
      setErr(String(e));
    }
  }
  function toggle(path: string) {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });
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

  function startVDrag(e: React.MouseEvent) {
    e.preventDefault();
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      const h = Math.min(rect.height - 140, Math.max(120, ev.clientY - rect.top));
      setTopH(h);
    };
    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
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
                if (tu.input.path === sel) setContent(tu.input.content);
                props.onFilesChanged?.();
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

  function renderNode(n: TreeNode, depth: number): React.ReactNode {
    return n.children.map((c) => {
      const pad = { paddingLeft: 8 + depth * 14 };
      if (c.isFile) {
        return (
          <div
            key={c.path}
            className={"tree-row" + (c.path === sel ? " active" : "")}
            style={pad}
            onClick={() => openFile(c.path)}
          >
            <span className="tree-icon">📄</span>
            {c.name}
          </div>
        );
      }
      const open = expanded.has(c.path);
      return (
        <div key={c.path}>
          <div className="tree-row" style={pad} onClick={() => toggle(c.path)}>
            <span className="tree-caret">{open ? "▾" : "▸"}</span>
            <span className="tree-icon">{open ? "📂" : "📁"}</span>
            {c.name}
          </div>
          {open && renderNode(c, depth + 1)}
        </div>
      );
    });
  }

  if (!root) {
    return (
      <div className="chat" style={{ justifyContent: "center" }}>
        <div className="hint" style={{ textAlign: "center" }}>
          文件功能仅在桌面版可用。
          <br />
          数据保存在你的用户目录 <code>job-copilot</code> 下
          <br />
          (preps / talk / jds / resumes)。
          {err && <div className="err">{err}</div>}
        </div>
      </div>
    );
  }

  const tree = buildTree(files);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div className="files-head">
        <span className="spacer" style={{ flex: 1 }} />
        <button className="small ghost" onClick={refresh}>刷新</button>
      </div>

      <div ref={bodyRef} className="files-body">
        <div className="files-top" style={{ height: topH }}>
          {sel ? (
            <div className="file-editor">
              <div className="row" style={{ marginBottom: 6 }}>
                <button className="small ghost" onClick={() => setSel("")}>
                  ← 列表
                </button>
                <span
                  className="hint"
                  style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={sel}
                >
                  {sel}
                </span>
                <button className="small ghost" onClick={() => setFileEditing((e) => !e)}>
                  {fileEditing ? "预览" : "编辑"}
                </button>
                <button className="small primary" disabled={!dirty} onClick={saveFile}>
                  {dirty ? "保存" : "已保存"}
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <MarkdownView
                  value={content}
                  editing={fileEditing}
                  onChange={(v) => {
                    setContent(v);
                    setDirty(true);
                  }}
                  placeholder="(空文件)"
                />
              </div>
            </div>
          ) : (
            <div className="tree">{renderNode(tree, 0)}</div>
          )}
        </div>

        <div className="hdivider" onMouseDown={startVDrag} title="拖拽调整 AI 区域大小" />

        <div className="files-chat">
          <div className="chat" ref={logRef} style={{ flex: 1 }}>
            {log.length === 0 && (
              <div className="hint" style={{ padding: 8 }}>
                让 AI 改文件,例如「把 resume 里 AI 方向版的自我介绍改得更突出开源作品」。
                AI 会读文件、提改动,写入前问你确认。
              </div>
            )}
            {log.map((m, i) =>
              m.kind === "assistant" ? (
                <div
                  key={i}
                  className="msg assistant md-preview"
                  dangerouslySetInnerHTML={{ __html: renderMd(m.text) }}
                />
              ) : (
                <div key={i} className={m.kind === "user" ? "msg user" : "hint"}>
                  {m.text}
                </div>
              ),
            )}
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
      </div>
    </div>
  );
}
