// 把投递记录映射成飞书多维表格字段(字段名对齐 boss-flow/base-fields.json)。
import type { ApplyRecord } from "./ledger";

// 赛道 select 仅这四个选项,自定义岗位归一到最接近的;无匹配则不填。
function trackOption(t: string): string | null {
  if (t.includes("投流") || t.includes("运营")) return "投流";
  if (t.includes("Meta") || t.includes("跨境")) return "Meta跨境";
  if (t.includes("AI") || t.includes("Agent")) return "AI";
  if (t.includes("医药") || t.includes("CDM")) return "医药CDM";
  return null;
}

// 城市 select 现有选项;不在其中则不填(避免飞书报未知选项)。
const CITY_OPTIONS = ["广州", "深圳", "南京", "苏州"];

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
    if (CITY_OPTIONS.includes(r.city)) fields["城市"] = r.city;
    const tk = trackOption(r.track);
    if (tk) fields["赛道"] = tk;
    return { fields };
  });
}
