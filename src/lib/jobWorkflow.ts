import { salaryMatches } from "../data/salaries.ts";
import type { ScoreStatus } from "./jobScoring.ts";

export interface CandidateScope {
  target: string;
  city: string;
  salary: string;
}

export interface CandidateScopeJob {
  title?: string;
  track?: string;
  city?: string;
  salary?: string;
}

export interface ScoreStatusLike {
  scoreStatus: ScoreStatus;
}

export interface ScoreProgress {
  total: number;
  done: number;
  running: number;
  failed: number;
  pending: number;
}

export function candidateMatchesScope(job: CandidateScopeJob, scope: CandidateScope): boolean {
  const targetOk = !scope.target || !job.track || job.track === scope.target;
  const cityOk = !scope.city || !job.city || job.city === scope.city;
  const salaryOk = salaryMatches(job.salary || "", scope.salary);
  return targetOk && cityOk && salaryOk;
}

export function shouldAutoScore(job: ScoreStatusLike): boolean {
  return job.scoreStatus === "pending";
}

export function scoreProgress(jobs: ScoreStatusLike[]): ScoreProgress {
  const total = jobs.length;
  const failed = jobs.filter((j) => j.scoreStatus === "failed").length;
  const running = jobs.filter((j) => j.scoreStatus === "scoring").length;
  const pending = jobs.filter((j) => j.scoreStatus === "pending").length;
  const scored = jobs.filter((j) => j.scoreStatus === "scored").length;
  return { total, done: scored + failed, running, failed, pending };
}
