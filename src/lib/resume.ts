export function countResumeImages(paths: string[]): number {
  return paths.filter(
    (p) => p.startsWith("resumes/") && p.toLowerCase().endsWith(".png"),
  ).length;
}

export interface ResumeImportNoticeInput {
  pages: number;
  extractedText: boolean;
  textWritten: boolean;
}

export function buildResumeImportNotice(input: ResumeImportNoticeInput): string {
  const imageText = `已导入 ${input.pages} 张简历图。`;
  if (input.extractedText && input.textWritten) {
    return `${imageText}已从 PDF 提取文字并写入 resumes/resume.md。`;
  }
  if (input.extractedText && !input.textWritten) {
    return `${imageText}PDF 已识别到文字，但已保留现有 Markdown 简历，未覆盖 resumes/resume.md。`;
  }
  return imageText;
}

interface PdfTextContentPage {
  getTextContent: () => Promise<{ items: unknown[] }>;
}

export async function readPdfPageTextSafely(page: PdfTextContentPage): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    return textContent.items
      .map((item) => (typeof item === "object" && item !== null && "str" in item && typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .trim();
  } catch {
    return "";
  }
}