import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, Star, Loader2 } from "lucide-react";
import { Modal, Button, StatusPill } from "../ui";
import { fsList, fsRead, fsReadBytes, fsWrite, fsWriteBytes } from "../lib/tauri";
import { renderMd } from "../lib/markdown";
import { buildResumeImportNotice, readPdfPageTextSafely } from "../lib/resume";
import { getDefaultResumePng, setDefaultResumePng } from "../state/resumeAssets";

interface PngItem {
  path: string; // resumes/简历_1.png
  name: string; // 简历_1.png
  url: string; // data:image/png;base64,...
}

function bytesToDataUrl(bytes: number[]): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.slice(i, i + CHUNK));
  }
  return "data:image/png;base64," + btoa(bin);
}

function dataUrlToBytes(dataUrl: string): number[] {
  const b64 = dataUrl.split(",")[1] || "";
  const bin = atob(b64);
  const out = new Array<number>(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): number[] {
  return dataUrlToBytes(canvas.toDataURL("image/png"));
}

/** 简历查看器：只读预览 Markdown 简历 + 管理/导入 PNG 简历图。 */
export function ResumeViewerModal(props: { root: string; onClose: () => void; onImported?: (notice: string) => void | Promise<void> }) {
  const [md, setMd] = useState("");
  const [pngs, setPngs] = useState<PngItem[]>([]);
  const [defaultPath, setDefaultPath] = useState(getDefaultResumePng());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      let mdText = "";
      try {
        mdText = await fsRead(props.root, "resumes/resume.md");
      } catch {
        /* 没有就空 */
      }
      setMd(mdText);

      const files = (await fsList(props.root)).filter(
        (p) => p.startsWith("resumes/") && p.toLowerCase().endsWith(".png"),
      );
      const items: PngItem[] = [];
      for (const p of files) {
        try {
          const bytes = await fsReadBytes(props.root, p);
          items.push({ path: p, name: p.replace(/^resumes\//, ""), url: bytesToDataUrl(bytes) });
        } catch {
          /* 跳过读不出的 */
        }
      }
      items.sort((a, b) => a.name.localeCompare(b.name, "zh", { numeric: true }));
      setPngs(items);
      setDefaultPath(getDefaultResumePng());
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.root]);

  /** 下一个 简历_N.png 序号（从 1 起）。 */
  function nextIndex(existing: string[]): number {
    let max = 0;
    for (const p of existing) {
      const m = p.match(/简历_(\d+)\.png$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
  }

  async function renderPdf(buf: ArrayBuffer): Promise<{ pages: number[][]; text: string }> {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages: number[][] = [];
    const textParts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const pageText = await readPdfPageTextSafely(page);
      if (pageText) textParts.push(pageText);

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法创建画布");
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      pages.push(canvasToPngBytes(canvas));
    }
    return { pages, text: textParts.join("\n\n").trim() };
  }

  async function imageToPng(file: File): Promise<number[]> {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    return canvasToPngBytes(canvas);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选同一文件
    if (!file) return;
    setErr("");
    setNotice("");
    setImporting("处理中…");
    try {
      const existing = pngs.map((p) => p.path);
      let n = nextIndex(existing);
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      const savedPaths: string[] = [];
      let extractedText = false;
      let textWritten = false;
      if (isPdf) {
        setImporting("解析 PDF…");
        const { pages, text } = await renderPdf(await file.arrayBuffer());
        if (pages.length === 0) throw new Error("PDF 没有可渲染的页面。");
        if (text) {
          extractedText = true;
          let existingMd = "";
          try {
            existingMd = await fsRead(props.root, "resumes/resume.md");
          } catch {
            /* 不存在则写入抽取文本 */
          }
          if (!existingMd.trim()) {
            await fsWrite(props.root, "resumes/resume.md", text);
            textWritten = true;
          }
        }
        for (const bytes of pages) {
          const path = `resumes/简历_${n}.png`;
          await fsWriteBytes(props.root, path, bytes);
          savedPaths.push(path);
          n++;
        }
      } else if (file.type.startsWith("image/")) {
        const bytes = await imageToPng(file);
        const path = `resumes/简历_${n}.png`;
        await fsWriteBytes(props.root, path, bytes);
        savedPaths.push(path);
      } else {
        throw new Error("仅支持 PDF 或图片(png/jpg)。");
      }

      // 无默认图时，把本次第一张设为默认
      if (!getDefaultResumePng() && savedPaths[0]) {
        setDefaultResumePng(savedPaths[0]);
      }
      const importNotice = buildResumeImportNotice({
        savedPaths,
        extractedText,
        textWritten,
      });
      await load();
      setNotice(importNotice);
      await props.onImported?.(importNotice);
    } catch (e2) {
      setErr("导入失败：" + String(e2));
    } finally {
      setImporting("");
    }
  }

  function makeDefault(path: string) {
    setDefaultResumePng(path);
    setDefaultPath(path);
  }

  return (
    <Modal title="简历" description="查看本地简历（Markdown 与简历图），并导入 PDF / 图片转为简历图" onClose={props.onClose} width={920}>
      <div className="grid gap-5 p-6 lg:grid-cols-2">
        {/* Markdown 简历 */}
        <section className="min-w-0">
          <h3 className="m-0 mb-2 flex items-center gap-2 text-card-title font-semibold text-text">
            <FileText size={16} strokeWidth={1.75} className="text-accent-strong" />
            Markdown 简历
            <span className="text-aux font-normal text-muted">resumes/resume.md</span>
          </h3>
          {loading ? (
            <div className="hint">加载中…</div>
          ) : md.trim() ? (
            <div
              className="md-preview max-h-[60vh] overflow-auto rounded border border-border bg-surface-2 p-4"
              dangerouslySetInnerHTML={{ __html: renderMd(md) }}
            />
          ) : (
            <div className="hint rounded border border-dashed border-border p-4">
              还没有简历，可在右侧「文件」里创建 <code>resumes/resume.md</code>。
            </div>
          )}
        </section>

        {/* PNG 简历图 */}
        <section className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="m-0 flex flex-1 items-center gap-2 text-card-title font-semibold text-text">
              <ImageIcon size={16} strokeWidth={1.75} className="text-accent-strong" />
              简历图（PNG）
            </h3>
            <Button
              variant="primary"
              size="sm"
              loading={!!importing}
              onClick={() => fileRef.current?.click()}
              icon={<Upload size={14} strokeWidth={1.75} />}
            >
              {importing || "导入 PDF / 图片"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={onPick}
            />
          </div>
          <p className="hint mb-2">
            导入 PDF（每页一张）或图片，转为简历图存到 <code>resumes/</code>，命名「简历_数字.png」。第一张自动设为投递默认附图。
          </p>

          {err && <div className="err mb-2">{err}</div>}
          {notice && !err && <div className="mb-2 rounded border border-accent bg-accent-soft p-2 text-aux leading-5 text-text">{notice}</div>}

          {loading ? (
            <div className="hint">加载中…</div>
          ) : pngs.length === 0 ? (
            <div className="hint rounded border border-dashed border-border p-4 text-center">
              {importing ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="spin" /> {importing}
                </span>
              ) : (
                "还没有简历图，点上方「导入 PDF / 图片」。"
              )}
            </div>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-auto">
              {pngs.map((p) => {
                const isDefault = p.path === defaultPath;
                return (
                  <div
                    key={p.path}
                    className={
                      "flex flex-col gap-2 rounded border p-2 " +
                      (isDefault ? "border-accent bg-accent-soft" : "border-border bg-surface-2")
                    }
                  >
                    <button
                      type="button"
                      className="!border-0 !bg-transparent !p-0"
                      onClick={() => setLightbox(p.url)}
                      title="点击查看大图"
                    >
                      <img
                        src={p.url}
                        alt={p.name}
                        className="h-40 w-full cursor-zoom-in rounded border border-border bg-white object-contain"
                      />
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="flex-1 truncate text-aux text-text-2" title={p.name}>
                        {p.name}
                      </span>
                      {isDefault ? (
                        <StatusPill tone="accent" icon={<Star size={12} strokeWidth={2} />}>
                          默认 · 投递附图
                        </StatusPill>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => makeDefault(p.path)}>
                          设为默认
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,23,42,0.7)] p-6"
          onClick={() => setLightbox(null)}
          title="点击关闭"
        >
          <img
            src={lightbox}
            alt="简历大图"
            className="max-h-full max-w-full cursor-zoom-out rounded bg-white object-contain shadow-pop"
          />
        </div>
      )}
    </Modal>
  );
}
