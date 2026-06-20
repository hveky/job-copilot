// Markdown 渲染:marked 解析 + DOMPurify 净化(LLM 输出可能含 HTML)。
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: true });

export function renderMd(src: string): string {
  const html = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(html);
}
