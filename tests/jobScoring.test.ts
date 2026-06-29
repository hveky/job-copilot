import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScorePrompt,
  inferDirection,
  parseScoreResponse,
  runLimitedQueue,
  ruleFallbackScore,
} from "../src/lib/jobScoring.ts";

test("parseScoreResponse accepts structured JSON with score details", () => {
  const parsed = parseScoreResponse(`{
    "score": 86,
    "level": "高匹配",
    "reason": "Meta投放经验与岗位强相关",
    "highlights": ["有投流经历", "城市匹配"],
    "risks": ["经验年限偏浅"]
  }`);

  assert.equal(parsed.score, 86);
  assert.equal(parsed.level, "高匹配");
  assert.equal(parsed.reason, "Meta投放经验与岗位强相关");
  assert.deepEqual(parsed.highlights, ["有投流经历", "城市匹配"]);
  assert.deepEqual(parsed.risks, ["经验年限偏浅"]);
});

test("parseScoreResponse clamps invalid scores and keeps usable text", () => {
  const parsed = parseScoreResponse("120|方向匹配但薪资偏高");
  assert.equal(parsed.score, 100);
  assert.equal(parsed.level, "高匹配");
  assert.equal(parsed.reason, "方向匹配但薪资偏高");
});

test("ruleFallbackScore always returns a concrete score and level", () => {
  const scored = ruleFallbackScore({
    target: "AI 产品经理",
    city: "广州",
    salary: "不限",
    resume: "Meta 投放 运营 AI Agent 项目经历",
    title: "AI 产品经理",
    company: "某科技公司",
    jobCity: "广州",
    salaryText: "15-25K",
    tags: "1-3年 本科",
  });

  assert.ok(scored.score >= 60);
  assert.notEqual(scored.score, undefined);
  assert.match(scored.reason, /规则兜底/);
});

test("inferDirection maps titles into stable directions", () => {
  assert.equal(inferDirection("Meta 跨境投放优化师", "广告 运营"), "投流/增长");
  assert.equal(inferDirection("AI Agent 产品经理", "AIGC SaaS"), "AI/Agent");
  assert.equal(inferDirection("医药 CDM 项目助理", "药企"), "医药/CDM");
});

test("buildScorePrompt includes the fixed scoring dimensions", () => {
  const prompt = buildScorePrompt({
    target: "AI 产品经理",
    city: "广州",
    salary: "不限",
    resume: "项目经历",
    title: "AI 产品经理",
    company: "某公司",
    jobCity: "广州",
    salaryText: "15-25K",
    tags: "本科",
    jd: "负责 AI 产品",
  });

  assert.match(prompt, /岗位目标匹配/);
  assert.match(prompt, /简历证据/);
  assert.match(prompt, /薪资城市/);
  assert.match(prompt, /经验学历/);
  assert.match(prompt, /赛道相关性/);
});

test("runLimitedQueue does not exceed the configured concurrency", async () => {
  let active = 0;
  let maxActive = 0;
  const result = await runLimitedQueue([1, 2, 3, 4, 5], 3, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return item * 2;
  });

  assert.deepEqual(result, [2, 4, 6, 8, 10]);
  assert.equal(maxActive, 3);
});
