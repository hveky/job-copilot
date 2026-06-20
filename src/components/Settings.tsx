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

        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field">DeepSeek base_url(Anthropic 兼容)</label>
            <input
              value={s.dsBaseUrl}
              onChange={(e) => set("dsBaseUrl", e.target.value)}
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
        </div>

        <label className="field">我的简历(全文 / 要点,用于针对性优化与话术)</label>
        <textarea
          rows={6}
          value={s.resume}
          placeholder="粘贴简历正文或核心要点……"
          onChange={(e) => set("resume", e.target.value)}
        />

        <label className="field">投递安全(防风控)</label>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="hint">单日上限</span>
            <input
              type="number"
              value={s.dailyCap}
              onChange={(e) => set("dailyCap", Number(e.target.value) || 0)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span className="hint">最小间隔(秒)</span>
            <input
              type="number"
              value={s.delayMin}
              onChange={(e) => set("delayMin", Number(e.target.value) || 0)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span className="hint">最大间隔(秒)</span>
            <input
              type="number"
              value={s.delayMax}
              onChange={(e) => set("delayMax", Number(e.target.value) || 0)}
            />
          </div>
        </div>

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
