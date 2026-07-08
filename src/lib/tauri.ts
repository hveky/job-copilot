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
  area?: string;
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

/**
 * 订阅「BOSS 扩展推送了岗位」事件(Rust 桥接服务在写完 jds/ 后 emit)。
 * 返回取消订阅函数;非桌面环境是空操作。
 */
export async function listenJobsReceived(
  cb: (written: number) => void,
): Promise<() => void> {
  if (!isDesktop()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<number>("jobs-received", (e) => cb(e.payload ?? 0));
  return un;
}

// ===== 文件 agent =====
/** 固定数据根目录(用户主目录下 job-copilot),Rust 会确保 preps/talk/jds/resumes 存在。 */
export async function dataRoot(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("data_root");
}

export async function bridgeToken(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("bridge_token");
}

export async function fsList(root: string): Promise<string[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string[]>("fs_list", { root });
}

export async function fsRead(root: string, path: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("fs_read", { root, path });
}

/** 读取 resumes/ 下所有文本文件并拼接为简历文本(用于生成/荐岗/话术)。 */
export async function readResume(
  root: string,
): Promise<{ text: string; count: number }> {
  const files = (await fsList(root)).filter((p) => p.startsWith("resumes/"));
  const parts: string[] = [];
  for (const f of files) {
    try {
      parts.push(await fsRead(root, f));
    } catch {
      /* skip unreadable */
    }
  }
  return { text: parts.join("\n\n").trim(), count: files.length };
}

export async function fsWrite(
  root: string,
  path: string,
  content: string,
): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("fs_write", { root, path, content });
}

export async function fsWriteBytes(root: string, path: string, bytes: number[]): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("fs_write_bytes", { root, path, data: bytes });
}

export async function fsReadBytes(root: string, path: string): Promise<number[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number[]>("fs_read_bytes", { root, path });
}

/** 飞书 OAuth token 组。accessToken 约 2 小时过期,refreshToken 用于静默续期(每次续期会轮换)。 */
export interface FeishuTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
}

/** 飞书账号授权(OAuth),返回 token 组。 */
export async function feishuOAuth(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<FeishuTokens> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FeishuTokens>("feishu_oauth", { clientId, clientSecret, redirectUri });
}

/** 用 refresh_token 静默续期 user_access_token。 */
export async function feishuRefresh(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<FeishuTokens> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FeishuTokens>("feishu_refresh", { clientId, clientSecret, refreshToken });
}

/** 同步记录到飞书多维表格。userToken 非空则以账号身份写。返回写入条数。 */
export async function feishuSync(
  appId: string,
  appSecret: string,
  userToken: string,
  baseToken: string,
  tableId: string,
  records: unknown[],
): Promise<number> {
  const { invoke } = await import("@tauri-apps/api/core");
  const n = await invoke<string>("feishu_sync", {
    appId,
    appSecret,
    userToken,
    baseToken,
    tableId,
    records: JSON.stringify(records),
  });
  return Number(n) || 0;
}

export interface BossReplies {
  total: number;
  withReply: number;
  items: { name: string; last: string; unread: boolean }[];
}

/** 抓 BOSS 聊天列表统计回复(总会话/有新回复)。 */
export async function bossReplies(): Promise<BossReplies> {
  const { invoke } = await import("@tauri-apps/api/core");
  const json = await invoke<string>("boss_replies");
  return JSON.parse(json) as BossReplies;
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
