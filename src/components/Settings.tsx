import { useState } from "react";
import type { Settings } from "../state/settings";

export function SettingsModal(props: {
  initial: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<Settings>(props.initial);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  return (
    <div className="modal-mask" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>设置</h2>
        <p className="hint">
          Key 仅存本机浏览器(localStorage)。包入 Tauri 后将迁移到系统安全存储 +
          Rust 核心,不再进渲染层。
        </p>

        <label className="field">DeepSeek API Key(默认主力 · light/deep 档)</label>
        <input
          type="password"
          value={s.dsKey}
          placeholder="sk-..."
          onChange={(e) => set("dsKey", e.target.value)}
        />

        <label className="field">Anthropic API Key(可选 · premium 精修档)</label>
        <input
          type="password"
          value={s.claudeKey}
          placeholder="sk-ant-...(不填则精修档不可用)"
          onChange={(e) => set("claudeKey", e.target.value)}
        />

        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field">DeepSeek base_url(Anthropic 兼容)</label>
            <input
              value={s.dsBaseUrl}
              onChange={(e) => set("dsBaseUrl", e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field">Anthropic base_url</label>
            <input
              value={s.claudeBaseUrl}
              onChange={(e) => set("claudeBaseUrl", e.target.value)}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field">轻活模型(light)</label>
            <input
              value={s.modelFlash}
              onChange={(e) => set("modelFlash", e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field">深度模型(deep)</label>
            <input
              value={s.modelPro}
              onChange={(e) => set("modelPro", e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field">精修模型(premium)</label>
            <input
              value={s.modelOpus}
              onChange={(e) => set("modelOpus", e.target.value)}
            />
          </div>
        </div>

        <label className="field">我的简历(全文 / 要点,用于针对性优化与话术)</label>
        <textarea
          rows={6}
          value={s.resume}
          placeholder="粘贴简历正文或核心要点……"
          onChange={(e) => set("resume", e.target.value)}
        />

        <div className="actions">
          <button className="ghost" onClick={props.onClose}>
            取消
          </button>
          <button className="primary" onClick={() => props.onSave(s)}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
