// 默认简历图（投递「附简历图」用哪张）。存相对路径，如 "resumes/简历_1.png"。
const DEFAULT_PNG_KEY = "qzc.resume.defaultPng.v1";

export function getDefaultResumePng(): string {
  try {
    return localStorage.getItem(DEFAULT_PNG_KEY) || "";
  } catch {
    return "";
  }
}

export function setDefaultResumePng(path: string): void {
  try {
    localStorage.setItem(DEFAULT_PNG_KEY, path);
  } catch {
    /* ignore */
  }
}
