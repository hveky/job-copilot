import { useEffect, useState } from "react";
import { DEFAULT_INSTRUCTION } from "../state/settings";
import { MarkdownView } from "./MarkdownView";

// 主控指令编辑器(CLAUDE.md 式):一段常驻文本,注入每次 AI 调用。支持预览/编辑。
export function InstructionPanel(props: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(props.value);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(props.value), [props.value]);
  const dirty = draft !== props.value;

  function save() {
    props.onChange(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
        <button className="small ghost" onClick={() => setEditing((e) => !e)}>
          {editing ? "预览" : "编辑"}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <MarkdownView
          value={draft}
          editing={editing}
          onChange={setDraft}
          placeholder="写下你的偏好:语气、量化要求、不许声称的技能、目标赛道……"
        />
      </div>

      <div className="row">
        <button className="primary" disabled={!dirty} onClick={save}>
          {saved ? "已保存 ✓" : dirty ? "保存" : "已保存 ✓"}
        </button>
        <button className="ghost small" onClick={() => setDraft(DEFAULT_INSTRUCTION)}>
          恢复默认
        </button>
        {dirty && <span className="hint">有未保存改动</span>}
      </div>
    </div>
  );
}
