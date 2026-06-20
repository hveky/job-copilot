// 城市 → BOSS 直聘 city 码(Phase B 自动抓 JD 搜索用)。
export interface City {
  label: string;
  code: string;
}

export const CITIES: City[] = [
  { label: "广州", code: "101280100" },
  { label: "深圳", code: "101280600" },
  { label: "杭州", code: "101210100" },
  { label: "苏州", code: "101190400" },
  { label: "合肥", code: "101220100" },
  { label: "南京", code: "101190100" },
  { label: "北京", code: "101010100" },
  { label: "上海", code: "101020100" },
  { label: "成都", code: "101270100" },
  { label: "武汉", code: "101200100" },
];

export function cityCode(label: string): string {
  return CITIES.find((c) => c.label === label)?.code ?? "";
}
