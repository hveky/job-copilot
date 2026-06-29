import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResumeImportNotice,
  countResumeImages,
  formatPdfTextItems,
  readPdfPageTextSafely,
} from "../src/lib/resume.ts";

test("countResumeImages only counts PNG files under resumes", () => {
  assert.equal(
    countResumeImages([
      "resumes/简历_1.png",
      "resumes/简历_2.PNG",
      "resumes/resume.md",
      "jds/简历_3.png",
      "resumes/note.txt",
    ]),
    2,
  );
});

test("buildResumeImportNotice explains when PDF text is not written over existing Markdown", () => {
  assert.equal(
    buildResumeImportNotice({
      savedPaths: ["resumes/简历_1.png", "resumes/简历_2.png"],
      extractedText: true,
      textWritten: false,
    }),
    "已保存 2 张 PDF 页面图到 resumes/简历_1.png 等；PDF 已识别到文字，但已保留现有 Markdown 简历，未覆盖 resumes/resume.md。",
  );
});

test("buildResumeImportNotice reports written text and saved image path", () => {
  assert.equal(
    buildResumeImportNotice({
      savedPaths: ["resumes/简历_1.png"],
      extractedText: true,
      textWritten: true,
    }),
    "已保存 1 张 PDF 页面图到 resumes/简历_1.png；已从 PDF 提取文字并写入 resumes/resume.md。",
  );
});

test("buildResumeImportNotice reports image-only imports", () => {
  assert.equal(
    buildResumeImportNotice({
      savedPaths: ["resumes/简历_1.png"],
      extractedText: false,
      textWritten: false,
    }),
    "已保存 1 张 PDF 页面图到 resumes/简历_1.png。",
  );
});

test("formatPdfTextItems sorts by coordinates and keeps line breaks", () => {
  const text = formatPdfTextItems([
    { str: "经历", transform: [1, 0, 0, 1, 120, 680] },
    { str: "姓名", transform: [1, 0, 0, 1, 40, 720] },
    { str: "胡长", transform: [1, 0, 0, 1, 90, 720] },
    { str: "项目", transform: [1, 0, 0, 1, 40, 680] },
  ]);

  assert.equal(text, "姓名 胡长\n项目 经历");
});

test("readPdfPageTextSafely ignores text layer failures", async () => {
  const page = {
    async getTextContent() {
      throw new Error("bad text layer");
    },
  };

  assert.equal(await readPdfPageTextSafely(page), "");
});