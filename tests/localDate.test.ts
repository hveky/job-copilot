import test from "node:test";
import assert from "node:assert/strict";

import { isSameLocalDay, localDateKey } from "../src/lib/localDate.ts";

test("localDateKey 按本地日历日生成键(含补零)", () => {
  assert.equal(localDateKey(new Date(2026, 6, 7, 0, 30).getTime()), "2026-07-07");
  assert.equal(localDateKey(new Date(2026, 0, 3, 23, 59).getTime()), "2026-01-03");
});

test("isSameLocalDay 以本地零点为界,不受 UTC 日期影响", () => {
  const lateNight = new Date(2026, 6, 7, 23, 59).getTime();
  const sameDayStart = new Date(2026, 6, 7, 0, 0).getTime();
  const nextMorning = new Date(2026, 6, 8, 0, 1).getTime();
  assert.equal(isSameLocalDay(lateNight, sameDayStart), true);
  assert.equal(isSameLocalDay(lateNight, nextMorning), false);
});
