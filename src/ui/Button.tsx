import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "primary",
  secondary: "",
  ghost: "ghost",
  danger: "danger",
  icon: "icon-btn ghost",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}

/** 统一按钮：primary/secondary/ghost/danger/icon + loading/disabled。 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    size === "sm" ? "small" : "",
    "inline-flex items-center justify-center gap-1.5",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <Loader2 size={size === "sm" ? 14 : 16} className="spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
