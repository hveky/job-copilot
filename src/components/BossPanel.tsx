import { useState } from "react";
import { isDesktop, openBossWindow } from "../lib/tauri";

// BOSS 投递台(Phase B step 1):打开内置 BOSS 浏览器登录,登录态持久化。
// 后续在此基础上接 自动抓 JD → 定制招呼语 → 半自动投递。
export function BossPanel() {
  const [err, setErr] = useState("");
  const [opening, setOpening] = useState(false);
  const desktop = isDesktop();

  async function open() {
    setErr("");
    setOpening(true);
    try {
      await openBossWindow();
    } catch (e) {
      setErr(String(e));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="card">
      <h3>BOSS 自动投递 · 桌面版</h3>
      {desktop ? (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            打开内置 BOSS 浏览器并用手机扫码登录。<strong>登录态会被记住</strong>,下次免登录。
            后续这里会按 目标岗位 + 城市 自动抓 JD、生成定制招呼语、半自动投递(发送前人工审核)。
          </p>
          <div className="row">
            <button className="primary" disabled={opening} onClick={open}>
              {opening ? "打开中…" : "打开 / 登录 BOSS"}
            </button>
            <span className="tier-pill">step 1 · 登录持久化</span>
          </div>
          {err && <div className="err">{err}</div>}
        </>
      ) : (
        <p className="hint" style={{ marginTop: 0 }}>
          此功能仅<strong>桌面版</strong>可用——需要内置浏览器承载 BOSS 登录与自动化。
          当前是网页预览版,请用 <code>npx tauri dev</code> 启动桌面版体验。
        </p>
      )}
    </div>
  );
}
