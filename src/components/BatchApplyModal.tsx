import { useRef, useState } from "react";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { greetingSystem, greetingUser } from "../prompts/templates";
import { bossApply, type BossJob } from "../lib/tauri";
import { bumpDaily, getDaily, loadApplied, markApplied } from "../lib/ledger";

type RowStatus = "pending" | "sending" | "sent" | "failed" | "skipped";
interface Row {
  job: BossJob;
  greeting: string;
  include: boolean;
  status: RowStatus;
  error?: string;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  pending: "待投",
  sending: "投递中",
  sent: "已投",
  failed: "失败",
  skipped: "跳过",
};

// 批量半自动投递(PRD §5.2.5):审核表 → 随机节流 → 异常即停 → 去重 + 单日上限。
export function BatchApplyModal(props: {
  gateway: GatewayConfig;
  jobs: BossJob[];
  jobLabel: string;
  resume: string;
  instruction: string;
  dailyCap: number;
  delayMin: number;
  delayMax: number;
  onClose: () => void;
  onAppliedId: (id: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    const applied = loadApplied();
    return props.jobs.map((j) => {
      const dup = applied.has(j.id || j.href);
      return {
        job: j,
        greeting: "",
        include: !dup,
        status: dup ? ("skipped" as RowStatus) : ("pending" as RowStatus),
        error: dup ? "已投过" : undefined,
      };
    });
  });
  const [genning, setGenning] = useState(false);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [countdown, setCountdown] = useState(0);
  const stopRef = useRef(false);

  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const includedPending = rows.filter(
    (r) => r.include && r.status === "pending",
  ).length;
  const sentCount = rows.filter((r) => r.status === "sent").length;

  async function genAll() {
    setGenning(true);
    setNote("");
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.include || r.status !== "pending" || r.greeting.trim()) continue;
      set(i, { error: undefined });
      try {
        let g = "";
        await chat(props.gateway, {
          tier: "light",
          system: greetingSystem(props.instruction),
          messages: [
            {
              role: "user",
              content: greetingUser({
                job: props.jobLabel,
                jd: `岗位:${r.job.title}\n公司:${r.job.company}\n${r.job.tags}`,
                resume: props.resume,
              }),
            },
          ],
          maxTokens: 500,
          onDelta: (t) => {
            g += t;
            set(i, { greeting: g });
          },
        });
        if (!g.trim()) set(i, { error: "生成为空,点「生成招呼语」重试" });
      } catch (e) {
        set(i, { error: e instanceof GatewayError ? e.message : String(e) });
      }
    }
    setGenning(false);
  }

  async function countdownSleep(sec: number) {
    for (let s = sec; s > 0; s--) {
      if (stopRef.current) return;
      setCountdown(s);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(0);
  }

  async function run() {
    stopRef.current = false;
    setRunning(true);
    setNote("");
    for (let i = 0; i < rows.length; i++) {
      if (stopRef.current) {
        setNote("已手动停止。");
        break;
      }
      const r = rows[i];
      if (!r.include || r.status !== "pending") continue;
      if (!r.greeting.trim()) {
        set(i, { status: "skipped", error: "无招呼语" });
        continue;
      }
      if (getDaily() >= props.dailyCap) {
        setNote(`已达单日上限 ${props.dailyCap} 条,停止。`);
        break;
      }
      set(i, { status: "sending" });
      try {
        const res = await bossApply(r.job.href, r.greeting.trim());
        if (res.ok) {
          markApplied(r.job.id || r.job.href);
          bumpDaily();
          props.onAppliedId(r.job.id || r.job.href);
          set(i, { status: "sent" });
        } else {
          set(i, { status: "failed", error: "未确认发送" });
          setNote("疑似异常(未确认发送)→ 已暂停整批。请到 BOSS 窗口检查是否需验证码。");
          break;
        }
      } catch (e) {
        set(i, { status: "failed", error: String(e) });
        setNote("出错 → 已暂停整批:" + String(e));
        break;
      }
      const more = rows
        .slice(i + 1)
        .some((x) => x.include && x.status === "pending");
      if (more && !stopRef.current) {
        const delay =
          props.delayMin +
          Math.floor(Math.random() * (props.delayMax - props.delayMin + 1));
        await countdownSleep(delay);
      }
    }
    setRunning(false);
    setCountdown(0);
  }

  return (
    <div className="modal-mask" onClick={running ? undefined : props.onClose}>
      <div
        className="modal"
        style={{ width: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>批量投递审核</h2>
        <p className="hint" style={{ marginTop: 4 }}>
          岗位「{props.jobLabel}」· 共 {rows.length} 条 · 待投 {includedPending} ·
          已投 {sentCount} · 今日已投 {getDaily()}/{props.dailyCap} ·
          间隔 {props.delayMin}-{props.delayMax}s 随机
        </p>

        <div className="batch-list">
          {rows.map((r, i) => (
            <div key={r.job.id || i} className="batch-row">
              <input
                type="checkbox"
                checked={r.include}
                disabled={running || r.status === "skipped"}
                onChange={(e) => set(i, { include: e.target.checked })}
                style={{ width: "auto", marginTop: 6 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="job-row-title" style={{ fontSize: 13 }}>
                  {r.job.title || "(无标题)"}
                  <span className={"batch-status st-" + r.status}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={r.greeting}
                  disabled={running}
                  placeholder="招呼语(点下方「生成招呼语」批量生成,可逐条改)"
                  onChange={(e) => set(i, { greeting: e.target.value })}
                  style={{ marginTop: 4, fontSize: 12.5 }}
                />
                {r.error && (
                  <span className="hint" style={{ color: "var(--warn)" }}>
                    {r.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {note && <div className="err">{note}</div>}
        {countdown > 0 && (
          <div className="hint" style={{ marginTop: 8 }}>
            ⏳ 防风控等待中,下一条 {countdown}s…
          </div>
        )}

        <div className="actions">
          <button className="ghost small" disabled={running || genning} onClick={genAll}>
            {genning ? "生成中…" : "生成招呼语"}
          </button>
          <span style={{ flex: 1 }} />
          {running ? (
            <button className="ghost" onClick={() => (stopRef.current = true)}>
              停止
            </button>
          ) : (
            <button className="ghost" onClick={props.onClose}>
              关闭
            </button>
          )}
          <button
            className="primary"
            disabled={running || genning || includedPending === 0}
            onClick={run}
          >
            开始投递({includedPending})
          </button>
        </div>
      </div>
    </div>
  );
}
