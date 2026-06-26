import { useEffect, useState } from "react";
import { fsList, fsRead } from "../lib/tauri";

interface InboxJob {
  path: string;
  score: number;
  title: string;
  company: string;
  salary: string;
  href: string;
  reason: string;
  jd: string; // 正文(去掉 meta 注释与标题块后的完整 JD)
}

const META_RE = /^<!--copilot-meta\s+([\s\S]*?)\s*-->\s*/;

/** 解析 jds/ 下一个 Markdown:取 copilot-meta JSON + 正文 JD。非本格式则跳过。 */
function parseInbox(path: string, raw: string): InboxJob | null {
  const m = raw.match(META_RE);
  if (!m) return null;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(m[1]);
  } catch {
    return null;
  }
  // 去掉 meta 注释 + 前两行引用块(# 标题 / > 评分 / > 来源),余下为 JD 正文
  let body = raw.slice(m[0].length);
  body = body.replace(/^#[^\n]*\n/, "").replace(/^(>[^\n]*\n)+/, "").trim();
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    path,
    score: num(meta.score),
    title: str(meta.title) || "(无标题)",
    company: str(meta.company),
    salary: str(meta.salary),
    href: str(meta.href),
    reason: str(meta.reason),
    jd: body,
  };
}

// 📥 候选岗位收件箱:展示 BOSS 扩展推送来的岗位(落在 jds/),一键灌进生成器备战。
export function JobInbox(props: {
  root: string;
  refreshKey: number;
  onUseJd: (jd: string) => void;
  onUseJob?: (title: string) => void;
}) {
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    if (!props.root) return;
    setErr("");
    setLoading(true);
    try {
      const files = (await fsList(props.root)).filter(
        (p) => p.startsWith("jds/") && p.toLowerCase().endsWith(".md"),
      );
      const out: InboxJob[] = [];
      for (const f of files) {
        try {
          const raw = await fsRead(props.root, f);
          const j = parseInbox(f, raw);
          if (j) out.push(j);
        } catch {
          /* skip unreadable */
        }
      }
      out.sort((a, b) => b.score - a.score);
      setJobs(out);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.root, props.refreshKey]);

  function use(j: InboxJob) {
    props.onUseJd(j.jd || "");
    if (j.title && j.title !== "(无标题)") props.onUseJob?.(j.title);
  }

  if (!props.root) return null;

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ flex: 1, margin: 0 }}>
          📥 候选岗位（BOSS 扩展推送）
          {jobs.length > 0 && (
            <span className="hint" style={{ marginLeft: 8, fontWeight: 400 }}>
              共 {jobs.length} 个
            </span>
          )}
        </h3>
        <button className="small ghost" disabled={loading} onClick={refresh}>
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      {err && <div className="err">{err}</div>}

      {jobs.length === 0 ? (
        <div className="hint" style={{ marginTop: 8 }}>
          还没有推送来的岗位。在 BOSS 扩展里筛岗、收藏后点「📥 推送已收藏到桌面端」，
          岗位会带着完整 JD、AI 评分与理由出现在这里。
        </div>
      ) : (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j) => (
            <div key={j.path} className="job-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="job-row-title">
                  <span
                    className="tier-pill"
                    style={{ marginRight: 6 }}
                    title="BOSS 扩展 AI 评分"
                  >
                    {j.score}
                  </span>
                  {j.title}
                </div>
                <div className="hint" style={{ marginTop: 2 }}>
                  {[j.company, j.salary].filter(Boolean).join(" · ")}
                </div>
                {j.reason && (
                  <div
                    className="hint"
                    style={{
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={j.reason}
                  >
                    💡 {j.reason}
                  </div>
                )}
              </div>
              {j.href && (
                <a
                  className="small ghost"
                  href={j.href}
                  target="_blank"
                  rel="noreferrer"
                  title="在浏览器打开 BOSS 原岗位"
                  style={{ textDecoration: "none" }}
                >
                  原岗位
                </a>
              )}
              <button
                className="small primary"
                onClick={() => use(j)}
                title="把这份 JD 灌进下方生成器，一键生成应试内容包"
              >
                用这个 JD 备战
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
