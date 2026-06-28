import { useEffect, useRef, useState } from "react";
import { Sparkles, Save, ImageDown, X } from "lucide-react";
import { Button } from "../ui";
import { chat } from "../gateway/client";
import type { GatewayConfig } from "../gateway/types";
import { resumeExtractSystem } from "../prompts/templates";
import { EMPTY_RESUME, loadResumeJson, saveResumeJson, type Resume } from "../state/resume";
import { fsWrite, fsWriteBytes } from "../lib/tauri";
import { ResumeDocument } from "./ResumeDocument";

function deepMerge(base: Resume, incoming: Partial<Resume>): Resume {
  return {
    basics: { ...base.basics, ...(incoming.basics ?? {}) },
    experience: Array.isArray(incoming.experience) ? incoming.experience.map((e) => ({
      company: e.company ?? "",
      role: e.role ?? "",
      start: e.start ?? "",
      end: e.end ?? "",
      bullets: Array.isArray(e.bullets) ? e.bullets : [],
    })) : base.experience,
    education: Array.isArray(incoming.education) ? incoming.education.map((e) => ({
      school: e.school ?? "",
      degree: e.degree ?? "",
      major: e.major ?? "",
      start: e.start ?? "",
      end: e.end ?? "",
    })) : base.education,
    skills: Array.isArray(incoming.skills) ? incoming.skills : base.skills,
    projects: Array.isArray(incoming.projects) ? incoming.projects.map((p) => ({
      name: p.name ?? "",
      desc: p.desc ?? "",
    })) : base.projects,
    links: Array.isArray(incoming.links) ? incoming.links.map((l) => ({
      label: l.label ?? "",
      url: l.url ?? "",
    })) : base.links,
  };
}

export function ResumeBuilderModal(props: {
  gateway: GatewayConfig;
  root: string;
  resumeText: string;
  onClose: () => void;
  onRawSaved?: () => void;
}) {
  const [resume, setResume] = useState<Resume>(EMPTY_RESUME);
  const [rawText, setRawText] = useState(props.resumeText);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const docRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [docH, setDocH] = useState(0);

  useEffect(() => {
    if (!props.root) return;
    loadResumeJson(props.root).then((r) => {
      if (r) setResume(r);
    }).catch(() => {});
  }, [props.root]);

  // 预览按容器宽度等比缩放 720px 文档，居中不裁切；导出 PNG 仍走未缩放的 docRef。
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 40; // 减去左右 padding
      setScale(Math.max(0.4, Math.min(1, w / 720)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDocH(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function setBasic(k: keyof Resume["basics"], v: string) {
    setResume((r) => ({ ...r, basics: { ...r.basics, [k]: v } }));
  }

  async function saveRaw() {
    setErr("");
    setNote("");
    if (!rawText.trim()) {
      setErr("请先粘贴简历文本。");
      return;
    }
    try {
      await fsWrite(props.root, "resumes/resume.md", rawText);
      setNote("原文已保存到 resumes/resume.md。");
      props.onRawSaved?.();
    } catch (e) {
      setErr("保存原文失败：" + String(e));
    }
  }

  async function aiExtract() {
    const source = (rawText.trim() ? rawText : props.resumeText).trim();
    if (!source) {
      setErr("请先在上方粘贴简历文本。");
      return;
    }
    setErr("");
    setNote("");
    setBusy(true);
    try {
      let raw = "";
      await chat(props.gateway, {
        tier: "light",
        system: resumeExtractSystem(),
        messages: [{ role: "user", content: source }],
        maxTokens: 2000,
        onDelta: (t) => { raw += t; },
      });
      // Strip markdown fences defensively
      const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      const parsed = JSON.parse(stripped) as Partial<Resume>;
      setResume(deepMerge(EMPTY_RESUME, parsed));
      setNote("AI 已预填，请检查并调整。");
    } catch (e) {
      setErr("AI 抽取失败：" + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setErr("");
    setNote("");
    try {
      await saveResumeJson(props.root, resume);
      setNote("已保存。");
    } catch (e) {
      setErr("保存失败：" + String(e));
    }
  }

  async function exportPng() {
    setErr("");
    setNote("");
    if (!docRef.current) {
      setErr("预览区未就绪。");
      return;
    }
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(docRef.current, {
        pixelRatio: 2,
        backgroundColor: "#fff",
        cacheBust: true,
      });
      const b64 = dataUrl.split(",")[1];
      const bin = atob(b64);
      const bytes = Array.from(bin, (c) => c.charCodeAt(0));
      await fsWriteBytes(props.root, "resumes/resume.png", bytes);
      setNote("已导出 → resumes/resume.png");
    } catch (e) {
      setErr("导出 PNG 失败：" + String(e));
    } finally {
      setBusy(false);
    }
  }

  // Experience helpers
  function addExp() {
    setResume((r) => ({
      ...r,
      experience: [...r.experience, { company: "", role: "", start: "", end: "", bullets: [] }],
    }));
  }
  function removeExp(i: number) {
    setResume((r) => ({ ...r, experience: r.experience.filter((_, j) => j !== i) }));
  }
  function setExp<K extends keyof Resume["experience"][0]>(i: number, k: K, v: Resume["experience"][0][K]) {
    setResume((r) => {
      const arr = [...r.experience];
      arr[i] = { ...arr[i], [k]: v };
      return { ...r, experience: arr };
    });
  }

  // Education helpers
  function addEdu() {
    setResume((r) => ({
      ...r,
      education: [...r.education, { school: "", degree: "", major: "", start: "", end: "" }],
    }));
  }
  function removeEdu(i: number) {
    setResume((r) => ({ ...r, education: r.education.filter((_, j) => j !== i) }));
  }
  function setEdu<K extends keyof Resume["education"][0]>(i: number, k: K, v: string) {
    setResume((r) => {
      const arr = [...r.education];
      arr[i] = { ...arr[i], [k]: v };
      return { ...r, education: arr };
    });
  }

  // Project helpers
  function addProj() {
    setResume((r) => ({ ...r, projects: [...r.projects, { name: "", desc: "" }] }));
  }
  function removeProj(i: number) {
    setResume((r) => ({ ...r, projects: r.projects.filter((_, j) => j !== i) }));
  }
  function setProj(i: number, k: "name" | "desc", v: string) {
    setResume((r) => {
      const arr = [...r.projects];
      arr[i] = { ...arr[i], [k]: v };
      return { ...r, projects: arr };
    });
  }

  // Link helpers
  function addLink() {
    setResume((r) => ({ ...r, links: [...r.links, { label: "", url: "" }] }));
  }
  function removeLink(i: number) {
    setResume((r) => ({ ...r, links: r.links.filter((_, j) => j !== i) }));
  }
  function setLink(i: number, k: "label" | "url", v: string) {
    setResume((r) => {
      const arr = [...r.links];
      arr[i] = { ...arr[i], [k]: v };
      return { ...r, links: arr };
    });
  }

  return (
    <div className="modal-mask" onClick={props.onClose}>
      <div
        className="modal"
        style={{ width: 1000, maxWidth: "96vw", maxHeight: "92vh", display: "flex", flexDirection: "column", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <h2 style={{ margin: 0, flex: 1 }}>简历编辑器</h2>
          <Button
            variant="ghost"
            size="sm"
            loading={busy}
            onClick={aiExtract}
            icon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            {busy ? "AI 处理中…" : "AI 从简历抽取预填"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={save}
            icon={<Save size={14} strokeWidth={1.75} />}
          >
            保存
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            onClick={exportPng}
            icon={<ImageDown size={14} strokeWidth={1.75} />}
          >
            {busy ? "导出中…" : "导出 PNG"}
          </Button>
          <button className="icon-btn ghost" onClick={props.onClose} title="关闭">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {(err || note) && (
          <div style={{ padding: "6px 20px", flexShrink: 0 }}>
            {err && <div className="err">{err}</div>}
            {note && !err && <div className="hint" style={{ color: "var(--ok)" }}>{note}</div>}
          </div>
        )}

        {/* Two-column body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: Form */}
          <div style={{ flex: "0 0 380px", overflowY: "auto", padding: "16px 20px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="field" style={{ fontWeight: 600 }}>原始简历文本</span>
                <button className="small ghost" onClick={saveRaw}>保存原文</button>
              </div>
              <p className="hint" style={{ margin: "0 0 6px" }}>
                粘贴简历全文或要点，点「保存原文」存到 resumes/resume.md，再用「AI 从简历抽取预填」自动填充下方表单。
              </p>
              <textarea
                rows={4}
                value={rawText}
                placeholder="粘贴简历正文或核心要点……"
                onChange={(e) => setRawText(e.target.value)}
                style={{ width: "100%" }}
              />
            </section>

            <section>
              <div className="field" style={{ fontWeight: 600, marginBottom: 6 }}>基本信息</div>
              {(["name", "headline", "phone", "email", "location"] as const).map((k) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <label className="field" style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 2 }}>
                    {k === "name" ? "姓名" : k === "headline" ? "职位标题" : k === "phone" ? "电话" : k === "email" ? "邮箱" : "地点"}
                  </label>
                  <input value={resume.basics[k]} onChange={(e) => setBasic(k, e.target.value)} style={{ width: "100%" }} />
                </div>
              ))}
              <div>
                <label className="field" style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 2 }}>个人简介</label>
                <textarea rows={3} value={resume.basics.summary} onChange={(e) => setBasic("summary", e.target.value)} style={{ width: "100%" }} />
              </div>
            </section>

            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="field" style={{ fontWeight: 600 }}>工作经历</span>
                <button className="small ghost" onClick={addExp}>+ 添加</button>
              </div>
              {resume.experience.map((exp, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="small ghost" onClick={() => removeExp(i)}>移除</button>
                  </div>
                  {(["role", "company", "start", "end"] as const).map((k) => (
                    <div key={k} style={{ marginBottom: 4 }}>
                      <label className="field" style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
                        {k === "role" ? "职位" : k === "company" ? "公司" : k === "start" ? "开始" : "结束"}
                      </label>
                      <input value={exp[k]} onChange={(e) => setExp(i, k, e.target.value)} style={{ width: "100%" }} />
                    </div>
                  ))}
                  <div>
                    <label className="field" style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>要点（每行一条）</label>
                    <textarea
                      rows={3}
                      value={exp.bullets.join("\n")}
                      onChange={(e) => setExp(i, "bullets", e.target.value.split("\n"))}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="field" style={{ fontWeight: 600 }}>教育</span>
                <button className="small ghost" onClick={addEdu}>+ 添加</button>
              </div>
              {resume.education.map((edu, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="small ghost" onClick={() => removeEdu(i)}>移除</button>
                  </div>
                  {(["school", "degree", "major", "start", "end"] as const).map((k) => (
                    <div key={k} style={{ marginBottom: 4 }}>
                      <label className="field" style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
                        {k === "school" ? "学校" : k === "degree" ? "学历" : k === "major" ? "专业" : k === "start" ? "开始" : "结束"}
                      </label>
                      <input value={edu[k]} onChange={(e) => setEdu(i, k, e.target.value)} style={{ width: "100%" }} />
                    </div>
                  ))}
                </div>
              ))}
            </section>

            <section>
              <div style={{ marginBottom: 6 }}>
                <span className="field" style={{ fontWeight: 600 }}>技能</span>
              </div>
              <div>
                <label className="field" style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 2 }}>技能列表（逗号分隔）</label>
                <textarea
                  rows={2}
                  value={resume.skills.join(", ")}
                  onChange={(e) => setResume((r) => ({
                    ...r,
                    skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  }))}
                  style={{ width: "100%" }}
                />
              </div>
            </section>

            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="field" style={{ fontWeight: 600 }}>项目</span>
                <button className="small ghost" onClick={addProj}>+ 添加</button>
              </div>
              {resume.projects.map((proj, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="small ghost" onClick={() => removeProj(i)}>移除</button>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <label className="field" style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>项目名</label>
                    <input value={proj.name} onChange={(e) => setProj(i, "name", e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label className="field" style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>描述</label>
                    <textarea rows={2} value={proj.desc} onChange={(e) => setProj(i, "desc", e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>
              ))}
            </section>

            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="field" style={{ fontWeight: 600 }}>链接</span>
                <button className="small ghost" onClick={addLink}>+ 添加</button>
              </div>
              {resume.links.map((link, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="small ghost" onClick={() => removeLink(i)}>移除</button>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <label className="field" style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>标签</label>
                    <input value={link.label} onChange={(e) => setLink(i, "label", e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label className="field" style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>URL</label>
                    <input value={link.url} onChange={(e) => setLink(i, "url", e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>
              ))}
            </section>
          </div>

          {/* Right: Preview（等比缩放，居中不裁切） */}
          <div
            ref={previewRef}
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#e8e8e8", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 20 }}
          >
            <div style={{ width: 720 * scale, height: docH ? docH * scale : undefined, flex: "0 0 auto" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <div ref={docRef} style={{ width: 720 }}>
                  <ResumeDocument resume={resume} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
