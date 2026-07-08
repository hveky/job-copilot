// 把投递记录映射成飞书多维表格字段(字段名对齐 boss-flow/base-fields.json),
// 以及 user_access_token 的过期判断与静默续期。
import type { ApplyRecord } from "./ledger";
import { feishuRefresh, type FeishuTokens } from "./tauri.ts";

// ===== user_access_token 续期 =====

/** 提前续期余量:离过期不足 5 分钟就视为需要续期,避免同步中途失效。 */
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/** access_token 是否需要续期。expireAt=0 表示旧版授权(无过期信息),不主动续期。 */
export function shouldRefreshFeishuToken(expireAt: number, now = Date.now()): boolean {
  return expireAt > 0 && now >= expireAt - TOKEN_EXPIRY_MARGIN_MS;
}

export interface FeishuTokenSettingsPatch {
  feishuUserToken: string;
  feishuRefreshToken: string;
  feishuTokenExpireAt: number;
}

/** 把 OAuth/续期返回的 token 组转成 Settings 补丁(含换算过期时间戳)。 */
export function feishuTokenPatch(tokens: FeishuTokens, now = Date.now()): FeishuTokenSettingsPatch {
  return {
    feishuUserToken: tokens.accessToken,
    feishuRefreshToken: tokens.refreshToken,
    feishuTokenExpireAt: tokens.expiresIn > 0 ? now + tokens.expiresIn * 1000 : 0,
  };
}

export interface FeishuAuthState {
  userToken: string;
  refreshToken: string;
  expireAt: number; // ms
}

/**
 * 返回可用的 user_access_token:未过期直接用;快过期且有 refresh_token 则静默续期,
 * 并通过 onTokens 回传新 token 组供持久化。续期失败回退旧 token(由服务端报错引导重新授权)。
 */
export async function ensureFeishuUserToken(
  auth: FeishuAuthState,
  clientId: string,
  clientSecret: string,
  onTokens?: (patch: FeishuTokenSettingsPatch) => void,
): Promise<string> {
  if (!auth.userToken) return "";
  if (!shouldRefreshFeishuToken(auth.expireAt)) return auth.userToken;
  if (!auth.refreshToken || !clientId || !clientSecret) return auth.userToken;
  try {
    const tokens = await feishuRefresh(clientId, clientSecret, auth.refreshToken);
    onTokens?.(feishuTokenPatch(tokens));
    return tokens.accessToken;
  } catch {
    return auth.userToken;
  }
}

// ===== 多维表格字段映射 =====

// 赛道 select 仅这四个选项,自定义岗位归一到最接近的;无匹配则不填。
function trackOption(t: string): string | null {
  if (t.includes("投流") || t.includes("运营")) return "投流";
  if (t.includes("Meta") || t.includes("跨境")) return "Meta跨境";
  if (t.includes("AI") || t.includes("Agent")) return "AI";
  if (t.includes("医药") || t.includes("CDM")) return "医药CDM";
  return null;
}

export function buildFeishuRecords(recs: ApplyRecord[]): unknown[] {
  return recs.map((r) => {
    const fields: Record<string, unknown> = {
      公司: r.company || "(未知)",
      岗位: r.title || "(未知)",
      投递日期: r.date,
      jobId: r.id,
      自我介绍: r.greeting || "",
      招呼语已发: true,
      自我介绍已发: !!r.greeting,
      HR回复: "未回",
      岗位链接: { link: r.href, text: r.href },
    };
    if (r.salary) fields["薪资"] = r.salary;
    if (r.track) fields["方向"] = r.track;
    // 城市为飞书单选;写未知选项会自动新增(不报错),故直接写原值。
    if (r.city) fields["城市"] = r.city;
    const tk = trackOption(r.track);
    if (tk) fields["赛道"] = tk;
    return { fields };
  });
}
