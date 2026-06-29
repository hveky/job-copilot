import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "ai" | "ok" | "warn" | "danger";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-2 border-border",
  accent: "bg-accent-soft text-accent-strong border-[color-mix(in_srgb,var(--accent)_35%,transparent)]",
  ai: "bg-ai-soft text-ai border-[color-mix(in_srgb,var(--ai)_35%,transparent)]",
  ok: "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-[color-mix(in_srgb,var(--ok)_80%,#000)] border-[color-mix(in_srgb,var(--ok)_35%,transparent)]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-[color-mix(in_srgb,var(--warn)_80%,#000)] border-[color-mix(in_srgb,var(--warn)_40%,transparent)]",
  danger: "bg-danger-soft text-danger border-[color-mix(in_srgb,var(--danger)_35%,transparent)]",
};

export interface StatusPillProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 状态药丸：用于授权状态、安全策略、模型档位等。 */
export function StatusPill({
  tone = "neutral",
  icon,
  children,
  className = "",
}: StatusPillProps) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-aux font-medium " +
        TONE[tone] +
        " " +
        className
      }
    >
      {icon}
      {children}
    </span>
  );
}
