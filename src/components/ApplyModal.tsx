import { useEffect, useRef, useState } from "react";
import { chat, GatewayError } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { greetingSystem, greetingUser } from "../prompts/templates";
import { bossApply, bossFetchJd, type BossJob } from "../lib/tauri";
import type { ApplyRecord } from "../lib/ledger";

type Phase = "loading" | "review" | "applying" | "done" | "error";

// 投递审核弹窗:抓 JD → 生成定制招呼语 → 用户审核/改 → 确认才打招呼+追发。
export function ApplyModal(props: {
  gateway: GatewayConfig;
  jobLabel: string;
  city: string;
  bossJob: BossJob;
  resume: string;
  instruction: string;
  onClose: () => void;
  onApplied: (rec: ApplyRecord) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [greeting, setGreeting] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const jdRef = useRef("");

  async function genGreeting(jd: string) {
    setGreeting("");
    await chat(props.gateway, {
      tier: "light",
      system: greetingSystem(props.instruction),
      messages: [
        {
          role: "user",
          content: greetingUser({ job: props.jobLabel, jd, resume: props.resume }),
        },
      ],
      maxTokens: 600,
      onDelta: (t) => setGreeting((g) => g + t),
    });
  }

  async function load() {
    setErr("");
    setPhase("loading");
    try {
      const detail = await bossFetchJd(props.bossJob.href);
      jdRef.current = detail.jd || "";
      await genGreeting(jdRef.current);
      setPhase("review");
    } catch (e) {
      setErr(e instanceof GatewayError ? e.message : String(e));
      setPhase("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regen() {
    setPhase("loading");
    try {
      await genGreeting(jdRef.current);
      setPhase("review");
    } catch (e) {
      setErr(String(e));
      setPhase("error");
    }
  }

  async function apply() {
    if (!greeting.trim()) {
      setErr("招呼语不能为空。");
      return;
    }
    setErr("");
    setPhase("applying");
    try {
      const r = await bossApply(props.bossJob.href, greeting.trim());
      setOk(r.ok);
      setPhase("done");
      props.onApplied({
        id: props.bossJob.id || props.bossJob.href,
        title: props.bossJob.title,
        company: props.bossJob.company,
        city: props.city,
        track: props.jobLabel,
        href: props.bossJob.href,
        greeting: greeting.trim(),
        date: Date.now(),
        synced: false,
      });
    } catch (e) {
      setErr(String(e));
      setPhase("error");
    }
  }

  return (
    <div className="modal-mask" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>投递审核</h2>
        <p className="hint" style={{ marginTop: 4 }}>
          {props.bossJob.title || props.jobLabel}
          {props.bossJob.company ? ` · ${props.bossJob.company}` : ""}
        </p>

        {phase === "loading" && (
          <div className="hint" style={{ padding: "16px 0" }}>
            正在抓 JD 并生成定制招呼语…
            {greeting && (
              <div className="content" style={{ marginTop: 10, minHeight: 0 }}>
                {greeting}
              </div>
            )}
          </div>
        )}

        {(phase === "review" || phase === "applying") && (
          <>
            <label className="field">
              定制招呼语(打招呼后自动追发,发送前可改)
            </label>
            <textarea
              rows={5}
              value={greeting}
              disabled={phase === "applying"}
              onChange={(e) => setGreeting(e.target.value)}
            />
            <p className="hint" style={{ marginTop: 8 }}>
              确认后:打开该岗位 → 点「立即沟通」(发平台统一招呼语)→ 追发上面这段。
              发送是真实外发动作。
            </p>
          </>
        )}

        {phase === "done" && (
          <div
            className="content"
            style={{ marginTop: 12, color: ok ? "var(--ok)" : "var(--warn)" }}
          >
            {ok
              ? "✓ 已打招呼并追发招呼语(输入框已清空=发送成功)。"
              : "⚠ 已尝试发送,但未确认输入框清空——请到 BOSS 窗口确认是否发出/是否需要验证码。"}
          </div>
        )}

        {err && <div className="err">{err}</div>}

        <div className="actions">
          {phase === "review" && (
            <>
              <button className="ghost small" onClick={regen}>
                重新生成
              </button>
              <button className="ghost" onClick={props.onClose}>
                取消
              </button>
              <button className="primary" onClick={apply}>
                确认投递
              </button>
            </>
          )}
          {phase === "applying" && (
            <button className="primary" disabled>
              投递中…
            </button>
          )}
          {(phase === "done" || phase === "error") && (
            <>
              {phase === "error" && (
                <button className="ghost small" onClick={load}>
                  重试
                </button>
              )}
              <button className="primary" onClick={props.onClose}>
                关闭
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
