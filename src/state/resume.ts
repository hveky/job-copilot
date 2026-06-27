export interface Resume {
  basics: { name: string; headline: string; phone: string; email: string; location: string; summary: string };
  experience: { company: string; role: string; start: string; end: string; bullets: string[] }[];
  education: { school: string; degree: string; major: string; start: string; end: string }[];
  skills: string[];
  projects: { name: string; desc: string }[];
  links: { label: string; url: string }[];
}

export const EMPTY_RESUME: Resume = {
  basics: { name: "", headline: "", phone: "", email: "", location: "", summary: "" },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  links: [],
};

import { fsRead, fsWrite } from "../lib/tauri";

export async function loadResumeJson(root: string): Promise<Resume | null> {
  try {
    return JSON.parse(await fsRead(root, "resumes/resume.json")) as Resume;
  } catch {
    return null;
  }
}

export async function saveResumeJson(root: string, r: Resume): Promise<void> {
  await fsWrite(root, "resumes/resume.json", JSON.stringify(r, null, 2));
}
