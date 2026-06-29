import { useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff, PlugZap, Loader2 } from "lucide-react";

/* ---------- Field：统一字段标签 + 说明 + 校验提示 ---------- */
export function Field({
  label,
  hint,
  warn,
  children,
  className = "",
}: {
  label?: ReactNode;
  hint?: ReactNode;
  warn?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block mb-1.5 text-aux font-medium text-text-2">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 mb-0 text-aux text-muted">{hint}</p>}
      {warn && (
        <p className="mt-1 mb-0 text-aux font-medium text-[color-mix(in_srgb,var(--warn)_85%,#000)]">
          {warn}
        </p>
      )}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

/* ---------- SecretInput：掩码 + 显隐 + 可选测试连接 ---------- */
export function SecretInput({
  value,
  onChange,
  placeholder,
  onTest,
  testing,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onTest?: () => void;
  testing?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <div className="relative flex-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          {...rest}
        />
        <button
          type="button"
          className="icon-btn ghost absolute right-1 top-1/2 -translate-y-1/2 !border-0 !bg-transparent"
          onClick={() => setShow((s) => !s)}
          title={show ? "隐藏" : "显示"}
          aria-label={show ? "隐藏" : "显示"}
        >
          {show ? (
            <EyeOff size={18} strokeWidth={1.75} />
          ) : (
            <Eye size={18} strokeWidth={1.75} />
          )}
        </button>
      </div>
      {onTest && (
        <button
          type="button"
          className="ghost inline-flex items-center gap-1.5 shrink-0"
          onClick={onTest}
          disabled={testing}
          title="测试连接"
        >
          {testing ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <PlugZap size={16} strokeWidth={1.75} />
          )}
          测试
        </button>
      )}
    </div>
  );
}

/* ---------- Toggle：开关 ---------- */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={
        "inline-flex items-center gap-2.5 select-none " +
        (disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer")
      }
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          "relative h-5 w-9 rounded-full !p-0 transition-colors " +
          (checked
            ? "bg-accent border-accent"
            : "bg-surface-2 border-border-strong")
        }
      >
        <span
          className={
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all " +
            (checked ? "left-[18px]" : "left-0.5")
          }
        />
      </button>
      {label && <span className="text-[13px] text-text">{label}</span>}
    </label>
  );
}

/* ---------- Slider：数字输入 + 滑块联动 ---------- */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-20 text-center"
        />
        {unit && <span className="text-aux text-muted">{unit}</span>}
      </div>
    </div>
  );
}
