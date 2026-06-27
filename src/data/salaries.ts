// 薪资档位(本地过滤用,不依赖 BOSS 内部薪资码)。label 空串 = 不限。
export interface SalaryBracket {
  label: string;
  lo: number; // 下界(K)
  hi: number; // 上界(K),Infinity 表无上限
}

// label "" 作为「不限」哨兵,不进下拉选项(下拉里用「不限」展示、value="")
export const SALARY_BRACKETS: SalaryBracket[] = [
  { label: "3-5K", lo: 3, hi: 5 },
  { label: "5-10K", lo: 5, hi: 10 },
  { label: "10-20K", lo: 10, hi: 20 },
  { label: "20-50K", lo: 20, hi: 50 },
  { label: "50K+", lo: 50, hi: Infinity },
];

/**
 * 岗位薪资文本是否落在所选档位内。
 * - label 为空(不限)→ 一律命中。
 * - 从文本解析出 [min,max](K),与档位 [lo,hi] 求区间重叠则命中。
 * - 解析不出(面议/按天/未知)→ 默认保留,避免误杀。
 * 支持: "15-25K" "20-40K·13薪" "8k" "1.5-3万"(万→K) "8000-12000元"(元→K)。
 */
export function salaryMatches(text: string, label: string): boolean {
  if (!label) return true;
  const bracket = SALARY_BRACKETS.find((b) => b.label === label);
  if (!bracket) return true;
  const range = parseSalary(text);
  if (!range) return true; // 解析不出 → 不误杀
  const [min, max] = range;
  // 区间重叠: 岗位 [min,max] 与档位 [lo,hi]
  return min <= bracket.hi && max >= bracket.lo;
}

/** 把薪资文本解析成 [minK, maxK]。解析不出返回 null。 */
function parseSalary(text: string): [number, number] | null {
  if (!text) return null;
  const t = text.replace(/\s/g, "");
  // 单位: 万 → ×10(K); 元/K/k → 看数量级
  const wan = /万/.test(t);
  const yuan = /\d{4,}/.test(t) && !/[kK千]/.test(t) && !wan; // 形如 8000-12000
  const nums = t.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  let lo = parseFloat(nums[0]);
  let hi = nums.length >= 2 ? parseFloat(nums[1]) : lo;
  if (wan) {
    lo *= 10;
    hi *= 10;
  } else if (yuan) {
    lo /= 1000;
    hi /= 1000;
  }
  if (!isFinite(lo) || lo <= 0) return null;
  if (hi < lo) hi = lo;
  return [lo, hi];
}
