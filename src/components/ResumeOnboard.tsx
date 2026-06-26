import { useState } from "react";

/**
 * 首次启动引导:resumes/ 为空时让用户粘贴简历,写入 resumes/resume.md。
 * 之后用户可在「文件」面板自行编辑/预览。
 */
export function ResumeOnboard(props: {
  onSubmit: (text: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await props.onSubmit(text.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-mask">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>先放进你的简历</h2>
        <p className="hint">
          粘贴你的简历(全文或要点)。它会保存为
          <code> resumes/resume.md</code>,之后用于针对性内容生成、AI 荐岗与话术。
          你随时可以在右侧「文件」面板里修改。
        </p>
        <textarea
          rows={12}
          value={text}
          placeholder="粘贴简历正文或核心要点……"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="actions">
          <button className="ghost" disabled={busy} onClick={props.onSkip}>
            稍后再说
          </button>
          <button className="primary" disabled={busy || !text.trim()} onClick={submit}>
            {busy ? "保存中…" : "保存简历"}
          </button>
        </div>
      </div>
    </div>
  );
}
