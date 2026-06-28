export interface ApplySafety {
  dailyCap: number;
  delayMin: number;
  delayMax: number;
}

const MIN_DAILY_CAP = 1;
const MIN_DELAY_SECONDS = 10;

function cleanInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.floor(value);
}

export function normalizeApplySafety(input: ApplySafety): ApplySafety {
  const dailyCap = Math.max(MIN_DAILY_CAP, cleanInt(input.dailyCap, MIN_DAILY_CAP));
  const delayMin = Math.max(MIN_DELAY_SECONDS, cleanInt(input.delayMin, MIN_DELAY_SECONDS));
  const rawDelayMax = Math.max(MIN_DELAY_SECONDS, cleanInt(input.delayMax, delayMin));
  const delayMax = Math.max(delayMin, rawDelayMax);
  return { dailyCap, delayMin, delayMax };
}

export function canApplyToday(currentDaily: number, dailyCap: number): boolean {
  return cleanInt(currentDaily, 0) < Math.max(MIN_DAILY_CAP, cleanInt(dailyCap, MIN_DAILY_CAP));
}

export function shouldRecordApplyResult(result: { ok: boolean }): boolean {
  return result.ok === true;
}
