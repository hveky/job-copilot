
export function bytesToDataUrl(bytes: number[]): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return "data:image/png;base64," + btoa(bin);
}
export function countResumeImages(paths: string[]): number {
  return paths.filter(
    (p) => p.startsWith("resumes/") && p.toLowerCase().endsWith(".png"),
  ).length;
}

export interface ResumeImportNoticeInput {
  savedPaths: string[];
  extractedText: boolean;
  textWritten: boolean;
}

export function buildResumeImportNotice(input: ResumeImportNoticeInput): string {
  const count = input.savedPaths.length;
  const firstPath = input.savedPaths[0] || "resumes/简历_1.png";
  const imageText = `已保存 ${count} 张 PDF 页面图到 ${firstPath}${count > 1 ? " 等" : ""}`;
  if (input.extractedText && input.textWritten) {
    return `${imageText}；已从 PDF 提取文字并写入 resumes/resume.md。`;
  }
  if (input.extractedText && !input.textWritten) {
    return `${imageText}；PDF 已识别到文字，但已保留现有 Markdown 简历，未覆盖 resumes/resume.md。`;
  }
  return `${imageText}。`;
}

export interface PdfTextItemLike {
  str?: string;
  transform?: unknown;
  width?: unknown;
}

interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

function isCjk(char: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/u.test(char);
}

function normalizePdfText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function shouldInsertSpace(prev: PositionedTextItem, next: PositionedTextItem): boolean {
  const prevLast = prev.text.at(-1) || "";
  const nextFirst = next.text.at(0) || "";
  const gap = next.x - (prev.x + prev.width);
  const base = Math.max(prev.fontSize, next.fontSize, 8);
  if (gap <= base * 0.35) return false;
  if (isCjk(prevLast) && isCjk(nextFirst)) {
    return gap > base * 1.8;
  }
  return gap > base * 0.45;
}

export function formatPdfTextItems(items: PdfTextItemLike[]): string {
  const positioned: PositionedTextItem[] = [];
  for (const item of items) {
    const text = normalizePdfText(item.str || "");
    if (!text) continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4]);
    const y = Number(transform[5]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      positioned.push({ text, x: 0, y: 0, width: text.length * 8, fontSize: 12 });
      continue;
    }
    const fontSize = Math.max(Math.abs(Number(transform[3]) || 12), 8);
    const width = Number.isFinite(Number(item.width))
      ? Math.max(Number(item.width), 0)
      : text.length * fontSize * 0.55;
    positioned.push({ text, x, y, width, fontSize });
  }

  if (positioned.length === 0) return "";

  positioned.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedTextItem[][] = [];
  for (const item of positioned) {
    const lastLine = lines.at(-1);
    const lineY = lastLine?.[0]?.y;
    const tolerance = Math.max(item.fontSize * 0.45, 3);
    if (lastLine && lineY !== undefined && Math.abs(lineY - item.y) <= tolerance) {
      lastLine.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = "";
      for (const item of line) {
        if (!out) {
          out = item.text;
          continue;
        }
        const prev = line[line.indexOf(item) - 1];
        out += (prev && shouldInsertSpace(prev, item) ? " " : "") + item.text;
      }
      return out.trim();
    })
    .filter(Boolean)
    .join("\n");
}

interface PdfTextContentPage {
  getTextContent: () => Promise<{ items: unknown[] }>;
}

export async function readPdfPageTextSafely(page: PdfTextContentPage): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    return formatPdfTextItems(textContent.items as PdfTextItemLike[]);
  } catch {
    return "";
  }
}