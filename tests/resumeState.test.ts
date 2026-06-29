import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResumeImportNotice,
  countResumeImages,
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
    buildResumeImportNotice({ pages: 2, extractedText: true, textWritten: false }),
    "已导入 2 张简历图。PDF 已识别到文字，但已保留现有 Markdown 简历，未覆盖 resumes/resume.md。",
  );
});

test("readPdfPageTextSafely ignores text layer failures", async () => {
  const page = {
    async getTextContent() {
      throw new Error("bad text layer");
    },
  };

  assert.equal(await readPdfPageTextSafely(page), "");
});