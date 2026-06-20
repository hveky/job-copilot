// Tauri 桌面能力封装。Web 预览版下这些只读不调用,动态 import 避免打包/运行报错。

/** 是否运行在 Tauri 桌面壳内。 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const BOSS_LABEL = "boss";
// 登录入口;未登录会引导扫码,登录后留在求职页。WebView2 默认持久化 cookie。
const BOSS_URL = "https://www.zhipin.com/web/geek/jobs";

/**
 * 打开(或聚焦)内置 BOSS 浏览器窗口。真实 WebView2,登录态持久化。
 * 已存在则聚焦,不重复开。
 */
export async function openBossWindow(): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

  const existing = await WebviewWindow.getByLabel(BOSS_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const win = new WebviewWindow(BOSS_LABEL, {
    url: BOSS_URL,
    title: "BOSS 直聘 · 登录(登录态会被记住)",
    width: 1180,
    height: 820,
  });

  await new Promise<void>((resolve, reject) => {
    win.once("tauri://created", () => resolve());
    win.once("tauri://error", (e) => reject(new Error(String(e.payload))));
  });
}
