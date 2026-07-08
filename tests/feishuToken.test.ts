import test from "node:test";
import assert from "node:assert/strict";

import { feishuTokenPatch, shouldRefreshFeishuToken } from "../src/lib/feishu.ts";

const MIN = 60 * 1000;

test("shouldRefreshFeishuToken 提前 5 分钟触发续期", () => {
  const now = 1_000_000_000;
  assert.equal(shouldRefreshFeishuToken(now + 60 * MIN, now), false); // 还有 1 小时
  assert.equal(shouldRefreshFeishuToken(now + 4 * MIN, now), true); // 只剩 4 分钟
  assert.equal(shouldRefreshFeishuToken(now - MIN, now), true); // 已过期
});

test("shouldRefreshFeishuToken 对旧版授权(无过期信息)不主动续期", () => {
  assert.equal(shouldRefreshFeishuToken(0, 1_000_000_000), false);
});

test("feishuTokenPatch 换算过期时间戳,expiresIn 缺失时置 0", () => {
  const now = 1_000_000_000;
  const patch = feishuTokenPatch(
    { accessToken: "at", refreshToken: "rt", expiresIn: 7200 },
    now,
  );
  assert.deepEqual(patch, {
    feishuUserToken: "at",
    feishuRefreshToken: "rt",
    feishuTokenExpireAt: now + 7200 * 1000,
  });
  assert.equal(
    feishuTokenPatch({ accessToken: "at", refreshToken: "", expiresIn: 0 }, now)
      .feishuTokenExpireAt,
    0,
  );
});
