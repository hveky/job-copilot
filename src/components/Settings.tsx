import { useState } from "react";
import {
  Cpu,
  RefreshCw,
  Bot,
  ShieldCheck,
  Database,
  Info,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Settings } from "../state/settings";
import { toGatewayConfig } from "../state/settings";
import { chat } from "../gateway/client";
import { feishuOAuth } from "../lib/tauri";
import { BUILTIN_FEISHU, hasBuiltinFeishu } from "../config/feishu";
import { normalizeApplySafety } from "../lib/applySafety";
import { Modal, Tabs, Field, SecretInput, Slider, StatusPill, Button } from "../ui";
import type { TabItem } from "../ui";

type Section = "model" | "feishu" | "boss" | "safety" | "storage";

const SECTIONS: TabItem<Section>[] = [
  { key: "model", label: "模型配置", icon: <Cpu size={16} strokeWidth={1.75} /> },
  { key: "feishu", label: "飞书同步", icon: <RefreshCw size={16} strokeWidth={1.75} /> },
  { key: "boss", label: "BOSS 扩展", icon: <Bot size={16} strokeWidth={1.75} /> },
  { key: "safety", label: "投递安全", icon: <ShieldCheck size={16} strokeWidth={1.75} /> },
  { key: "storage", label: "本地存储", icon: <Database size={16} strokeWidth={1.75} /> },
];

function two(n: number) {
  return String(n).padStart(2, "0");
}

export function SettingsModal(props: {
  initial: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<Settings>(props.initial);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((p) => ({ ...p, [k]: v }));
  const [section, setSection] = useState<Section>("model");
  const [authing, setAuthing] = useState(false);
  const [authNote, setAuthNote] = useState("");
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState("");
  const [savedAt, setSavedAt] = useState("");

  async function feishuAuth() {
    const cid = s.feishuAppId || BUILTIN_FEISHU.clientId;
    const csec = s.feishuAppSecret || BUILTIN_FEISHU.clientSecret;
    const redir = s.feishuRedirectUri || BUILTIN_FEISHU.redirectUri;
    if (!cid || !csec) {
      setAuthNote("请先填 client_id / client_secret(或在 config/feishu.ts 内置)。");
      return;
    }
    setAuthNote("");
    setAuthing(true);
    try {
      const token = await feishuOAuth(cid, csec, redir);
      set("feishuUserToken", token);
      setAuthNote("✓ 已授权,记得点保存设置。");
    } catch (e) {
      setAuthNote("授权失败:" + String(e));
    } finally {
      setAuthing(false);
    }
  }

  async function testConnection() {
    if (!s.dsKey.trim()) {
      setTestNote("请先填 DeepSeek API Key。");
      return;
    }
    setTestNote("");
    setTesting(true);
    try {
      await chat(toGatewayConfig(s), {
        tier: "light",
        system: "ping",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 8,
      });
      setTestNote("ok");
    } catch (e) {
      setTestNote("fail:" + String(e));
    } finally {
      setTesting(false);
    }
  }

  function save() {
    const next = { ...s, ...normalizeApplySafety(s) };
    const d = new Date();
    setSavedAt(`${two(d.getHours())}:${two(d.getMinutes())}`);
    props.onSave(next);
  }

  const intervalWarn =
    s.delayMin < 30
      ? "间隔过短可能触发风控,建议最小间隔 ≥ 30 秒。"
      : s.delayMin > s.delayMax
        ? "最小间隔大于最大间隔,保存时会自动归一化。"
        : "";

  // 健康状态 pills
  const health = (
    <div className="flex flex-wrap gap-2 px-6 py-3 bg-surface-2 border-b border-border">
      <StatusPill
        tone={s.dsKey ? "ok" : "warn"}
        icon={
          s.dsKey ? (
            <CheckCircle2 size={13} strokeWidth={2} />
          ) : (
            <AlertTriangle size={13} strokeWidth={2} />
          )
        }
      >
        {s.dsKey ? "DeepSeek 已配置" : "DeepSeek 未配置"}
      </StatusPill>
      <StatusPill tone={s.feishuUserToken ? "ok" : "neutral"}>
        {s.feishuUserToken ? "飞书已授权" : "飞书未授权"}
      </StatusPill>
      <StatusPill tone={s.bridgeToken ? "ok" : "warn"}>
        {s.bridgeToken ? "BOSS 扩展已就绪" : "BOSS 扩展待连接"}
      </StatusPill>
      <StatusPill tone="ok">本地存储正常</StatusPill>
    </div>
  );

  const footer = (
    <>
      <span className="flex-1 text-aux text-muted">
        {savedAt ? `上次保存于 ${savedAt}` : "改动尚未保存"}
      </span>
      <Button variant="ghost" onClick={props.onClose}>
        取消
      </Button>
      <Button variant="primary" onClick={save}>
        保存设置
      </Button>
    </>
  );

  return (
    <Modal
      title="设置"
      description="配置模型、同步、扩展接入与投递安全策略"
      onClose={props.onClose}
      width={1040}
      banner={health}
      footer={footer}
      closeOnMask={false}
    >
      <div className="flex min-h-[420px]">
        {/* SectionNav */}
        <div className="w-44 shrink-0 border-r border-border p-3">
          <Tabs
            items={SECTIONS}
            active={section}
            onChange={setSection}
            variant="nav"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {section === "model" && (
            <div className="flex flex-col gap-4 max-w-[640px]">
              <Field
                label="DeepSeek API Key（默认主力 · light/deep 档）"
                hint="Key 仅存本机浏览器(localStorage)。包入 Tauri 后将迁到系统安全存储 + Rust 核心,不再进渲染层。"
              >
                <SecretInput
                  value={s.dsKey}
                  onChange={(v) => set("dsKey", v)}
                  placeholder="sk-..."
                  onTest={testConnection}
                  testing={testing}
                />
              </Field>
              {testNote === "ok" && (
                <div className="hint inline-flex items-center gap-1 text-ok">
                  <CheckCircle2 size={14} strokeWidth={1.75} /> 连接成功
                </div>
              )}
              {testNote.startsWith("fail") && (
                <div className="err">连接失败:{testNote.slice(5)}</div>
              )}
              {testNote && testNote !== "ok" && !testNote.startsWith("fail") && (
                <div className="hint">{testNote}</div>
              )}

              <Field label="DeepSeek base_url（Anthropic 兼容）">
                <input
                  value={s.dsBaseUrl}
                  onChange={(e) => set("dsBaseUrl", e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="轻活模型（light）">
                  <input
                    value={s.modelFlash}
                    onChange={(e) => set("modelFlash", e.target.value)}
                  />
                </Field>
                <Field label="深度模型（deep）">
                  <input
                    value={s.modelPro}
                    onChange={(e) => set("modelPro", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {section === "feishu" && (
            <div className="flex flex-col gap-4 max-w-[640px]">
              {hasBuiltinFeishu() ? (
                <p className="hint m-0">
                  已内置应用,<strong>直接点下面「用飞书账号授权」</strong>,以你本人身份写表,无需任何配置。
                </p>
              ) : (
                <>
                  <p className="hint m-0">
                    需一个飞书应用的 client_id/secret 当 OAuth 客户端,并在其后台「安全设置」登记重定向 URL。
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="client_id（app_id）">
                      <input
                        value={s.feishuAppId}
                        onChange={(e) => set("feishuAppId", e.target.value)}
                      />
                    </Field>
                    <Field label="client_secret（app_secret）">
                      <SecretInput
                        value={s.feishuAppSecret}
                        onChange={(v) => set("feishuAppSecret", v)}
                      />
                    </Field>
                  </div>
                  <Field label="重定向 URL（登记到飞书应用后台）">
                    <input
                      value={s.feishuRedirectUri}
                      onChange={(e) => set("feishuRedirectUri", e.target.value)}
                    />
                  </Field>
                </>
              )}

              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  loading={authing}
                  onClick={feishuAuth}
                  icon={<KeyRound size={16} strokeWidth={1.75} />}
                >
                  {authing ? "授权中…" : "用飞书账号授权"}
                </Button>
                {s.feishuUserToken && (
                  <StatusPill tone="ok" icon={<CheckCircle2 size={13} strokeWidth={2} />}>
                    已授权
                  </StatusPill>
                )}
                {s.feishuUserToken && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => set("feishuUserToken", "")}
                  >
                    清除授权
                  </Button>
                )}
              </div>
              {authNote && <div className="hint">{authNote}</div>}

              <div className="grid grid-cols-2 gap-4">
                <Field label="base_token">
                  <input
                    value={s.feishuBaseToken}
                    onChange={(e) => set("feishuBaseToken", e.target.value)}
                  />
                </Field>
                <Field label="table_id">
                  <input
                    value={s.feishuTableId}
                    onChange={(e) => set("feishuTableId", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {section === "boss" && (
            <div className="flex flex-col gap-4 max-w-[640px]">
              <div className="flex items-start gap-2 rounded bg-ai-soft border border-[color-mix(in_srgb,var(--ai)_25%,transparent)] p-3 text-aux text-text-2">
                <Info size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ai" />
                <span>
                  桌面端在本机 <code>http://127.0.0.1:14530/jobs</code> 接收 BOSS 扩展推送的岗位。
                  把下面这串令牌(桌面端自动生成)填进扩展,收藏岗位后一键推送,即出现在「候选岗位」。
                </span>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-4">
                <Field label="接收端口">
                  <input value="14530" readOnly />
                </Field>
                <Field label="对接令牌（X-Copilot-Token · 桌面端自动生成）">
                  <input
                    value={s.bridgeToken || "桌面端启动后自动生成"}
                    readOnly
                  />
                </Field>
              </div>
            </div>
          )}

          {section === "safety" && (
            <div className="flex flex-col gap-5 max-w-[640px]">
              <Field label="单日上限（条）">
                <Slider
                  value={s.dailyCap}
                  onChange={(v) => set("dailyCap", v)}
                  min={1}
                  max={100}
                  unit="条"
                />
              </Field>
              <Field label="最小间隔（秒）">
                <Slider
                  value={s.delayMin}
                  onChange={(v) => set("delayMin", v)}
                  min={10}
                  max={300}
                  unit="秒"
                />
              </Field>
              <Field label="最大间隔（秒）" warn={intervalWarn}>
                <Slider
                  value={s.delayMax}
                  onChange={(v) => set("delayMax", v)}
                  min={10}
                  max={600}
                  unit="秒"
                />
              </Field>
            </div>
          )}

          {section === "storage" && (
            <div className="flex flex-col gap-4 max-w-[640px]">
              <div className="flex items-start gap-2 rounded bg-surface-2 border border-border p-3 text-aux text-text-2">
                <Database size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent-strong" />
                <span>
                  设置与投递记录保存在本机浏览器 localStorage。文件(简历、内容包、JD、话术)保存在用户目录
                  <code> job-copilot</code> 下(resumes / preps / jds / talk)。
                  包入 Tauri 后,Key 将迁移到系统安全存储。
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
