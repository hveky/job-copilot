import { useEffect, useState } from "react";
import { DEFAULT_INSTRUCTION } from "../state/settings";

// 主控指令编辑器(CLAUDE.md 式):一段常驻文本,注入每次 AI 调用。改它=改 AI 行为,无需 agent。
export function InstructionPanel(props: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(props.value);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(props.value), [props.value]);
  const dirty = draft !== props.value;

  function save() {
    props.onChange(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="composer" style={{ flex: 1, borderTop: 0, gap: 10 }}>
      <p className="hint" style={{ margin: 0 }}>
        这段「主控指令」会注入到<strong>每一次</strong>内容生成和回复助手的调用里——
        相当于你的 CLAUDE.md。改它就能统一调教 AI 的口径,不用改任何代码。
      </p>
      <textarea
        style={{ flex: 1, minHeight: 280, fontFamily: "ui-monospace, monospace" }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="写下你的偏好:语气、量化要求、不许声称的技能、目标赛道……"
      />
      <div className="row">
        <button className="primary" disabled={!dirty} onClick={save}>
          {saved ? "已保存 ✓" : dirty ? "保存" : "已保存 ✓"}
        </button>
        <button
          className="ghost small"
          onClick={() => setDraft(DEFAULT_INSTRUCTION)}
        >
          恢复默认
        </button>
        {dirty && <span className="hint">有未保存改动</span>}
      </div>
    </div>
  );
}
