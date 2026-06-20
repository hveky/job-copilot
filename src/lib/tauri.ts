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

export interface BossJob {
  id: string;
  href: string;
  title: string;
  salary: string;
  company: string;
  tags: string;
}

export interface BossJd {
  title: string;
  salary: string;
  company: string;
  jd: string;
}

/** 驱动 BOSS 窗口按岗位+城市码搜岗,抓列表。 */
export async function bossSearch(
  query: string,
  cityCode: string,
): Promise<BossJob[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  const json = await invoke<string>("boss_search", { query, city: cityCode });
  return JSON.parse(json) as BossJob[];
}

/** 打开某岗位详情页抓 JD。 */
export async function bossFetchJd(url: string): Promise<BossJd> {
  const { invoke } = await import("@tauri-apps/api/core");
  const json = await invoke<string>("boss_fetch_jd", { url });
  return JSON.parse(json) as BossJd;
}

/** 投递:打招呼 + 追发定制招呼语。必须用户审核后调用。 */
export async function bossApply(
  url: string,
  message: string,
): Promise<{ ok: boolean }> {
  const { invoke } = await import("@tauri-apps/api/core");
  const json = await invoke<string>("boss_apply", { url, message });
  try {
    return JSON.parse(json) as { ok: boolean };
  } catch {
    return { ok: true };
  }
}
