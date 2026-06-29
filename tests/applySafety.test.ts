import test from "node:test";
import assert from "node:assert/strict";

import {
  canApplyToday,
  normalizeApplySafety,
  shouldRecordApplyResult,
} from "../src/lib/applySafety.ts";

test("normalizeApplySafety clamps invalid daily cap and delay ranges", () => {
  assert.deepEqual(
    normalizeApplySafety({ dailyCap: 0, delayMin: -10, delayMax: 5 }),
    { dailyCap: 1, delayMin: 10, delayMax: 10 },
  );

  assert.deepEqual(
    normalizeApplySafety({ dailyCap: 30, delayMin: 90, delayMax: 40 }),
    { dailyCap: 30, delayMin: 90, delayMax: 90 },
  );
});

test("canApplyToday rejects attempts at or above the daily cap", () => {
  assert.equal(canApplyToday(29, 30), true);
  assert.equal(canApplyToday(30, 30), false);
  assert.equal(canApplyToday(31, 30), false);
});

test("shouldRecordApplyResult records only confirmed successful sends", () => {
  assert.equal(shouldRecordApplyResult({ ok: true }), true);
  assert.equal(shouldRecordApplyResult({ ok: false }), false);
});
