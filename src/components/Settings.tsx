import { useState } from "react";
import type { Settings } from "../state/settings";
import { feishuOAuth } from "../lib/tauri";
import { BUILTIN_FEISHU, hasBuiltinFeishu } from "../config/feishu";

export function SettingsModal(props: {
  initial: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<Settings>(props.initial);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((p) => ({ ...p, [k]: v }));
  const [authing, setAuthing] = useState(false);
  const [authNote, setAuthNote] = useState("");

  async function feishuAuth() {
    const cid = s.feishuAppId || BUILTIN_FEISHU.clientId;
    const csec = s.feishuAppSecret || BUILTIN_FEISHU.clientSecret;
    const redir = s.feishuRedirectUri || BUILTIN_FEISHU.redirectUri;
    if (!cid || !csec) {
      setAuthNote("请先填 client_id / client_secret(或在 config/feishu.ts 内置)。");
      return;
    }
    setAuthNote("");
    setAuthing(true);
    try {
      const token = await feishuOAuth(cid, csec, redir);
      set("feishuUserToken", token);
      setAuthNote("✓ 已授权,记得点保存。");
    } catch (e) {
      setAuthNote("授权失败:" + String(e));
    } finally {
      setAuthing(false);
    }
  }

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

        <label className="field">飞书同步(可选)</label>
        {hasBuiltinFeishu() ? (
          <p className="hint" style={{ marginTop: 0 }}>
            已内置应用,<strong>直接点下面「用飞书账号授权」</strong>,以你本人身份写表,无需任何配置。
          </p>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              需一个飞书应用的 client_id/secret 当 OAuth 客户端,并在其后台「安全设置」登记重定向 URL。
              (产品方可把凭证内置到 <code>config/feishu.ts</code>,则用户零配置。)
            </p>
            <div className="row" style={{ gap: 12 }}>
              <div style={{ flex: 1 }}>
                <span className="hint">client_id(app_id)</span>
                <input value={s.feishuAppId} onChange={(e) => set("feishuAppId", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="hint">client_secret(app_secret)</span>
                <input
                  type="password"
                  value={s.feishuAppSecret}
                  onChange={(e) => set("feishuAppSecret", e.target.value)}
                />
              </div>
            </div>
            <span className="hint">重定向 URL(登记到飞书应用后台)</span>
            <input
              value={s.feishuRedirectUri}
              onChange={(e) => set("feishuRedirectUri", e.target.value)}
            />
          </>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" disabled={authing} onClick={feishuAuth}>
            {authing ? "授权中…" : "用飞书账号授权"}
          </button>
          {s.feishuUserToken && <span className="tier-pill">已授权 ✓</span>}
          {s.feishuUserToken && (
            <button className="ghost small" onClick={() => set("feishuUserToken", "")}>
              清除授权
            </button>
          )}
        </div>
        {authNote && <div className="hint" style={{ marginTop: 4 }}>{authNote}</div>}
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="hint">base_token</span>
            <input
              value={s.feishuBaseToken}
              onChange={(e) => set("feishuBaseToken", e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span className="hint">table_id</span>
            <input
              value={s.feishuTableId}
              onChange={(e) => set("feishuTableId", e.target.value)}
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
