import test from "node:test";
import assert from "node:assert/strict";

import {
  candidateMatchesScope,
  scoreProgress,
  shouldAutoScore,
} from "../src/lib/jobWorkflow.ts";

const baseJob = {
  id: "1",
  title: "AI 产品经理",
  company: "某科技公司",
  salary: "10-20K",
  city: "广州",
  track: "AI 产品经理",
  scoreStatus: "pending",
};

test("candidateMatchesScope honors the active salary filter", () => {
  assert.equal(
    candidateMatchesScope(baseJob, {
      target: "AI 产品经理",
      city: "广州",
      salary: "10-20K",
    }),
    true,
  );
  assert.equal(
    candidateMatchesScope(baseJob, {
      target: "AI 产品经理",
      city: "广州",
      salary: "50K+",
    }),
    false,
  );
});

test("shouldAutoScore only queues pending rows", () => {
  assert.equal(shouldAutoScore({ scoreStatus: "pending" }), true);
  assert.equal(shouldAutoScore({ scoreStatus: "failed" }), false);
  assert.equal(shouldAutoScore({ scoreStatus: "scoring" }), false);
  assert.equal(shouldAutoScore({ scoreStatus: "scored" }), false);
});

test("scoreProgress reports actual scoring completion", () => {
  const progress = scoreProgress([
    { scoreStatus: "scored" },
    { scoreStatus: "failed" },
    { scoreStatus: "scoring" },
    { scoreStatus: "pending" },
  ]);

  assert.deepEqual(progress, {
    total: 4,
    done: 2,
    running: 1,
    failed: 1,
    pending: 1,
  });
});
