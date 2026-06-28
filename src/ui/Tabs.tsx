import type { ReactNode } from "react";

export interface TabItem<T extends string = string> {
  key: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  /** underline: 顶部下划线（侧栏）；segmented: 分段；nav: 左侧竖向导航（设置页） */
  variant?: "underline" | "segmented" | "nav";
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  active,
  onChange,
  variant = "underline",
  className = "",
}: TabsProps<T>) {
  if (variant === "nav") {
    return (
      <nav className={"flex flex-col gap-1 " + className}>
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={
              "flex items-center gap-2.5 px-3 py-2 rounded text-left text-[13px] font-medium border " +
              (it.key === active
                ? "bg-accent-soft text-accent-strong border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
                : "bg-transparent text-text-2 border-transparent hover:bg-surface-2 hover:text-text")
            }
          >
            {it.icon}
            <span className="truncate">{it.label}</span>
          </button>
        ))}
      </nav>
    );
  }

  if (variant === "segmented") {
    return (
      <div
        className={
          "inline-flex p-0.5 rounded bg-surface-2 border border-border gap-0.5 " +
          className
        }
      >
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-medium border-0 " +
              (it.key === active
                ? "bg-surface text-accent-strong shadow-sm"
                : "bg-transparent text-text-2 hover:text-text")
            }
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    );
  }

  // underline
  return (
    <div className={"flex border-b border-border px-1.5 " + className}>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={
            "flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-3 font-medium border-0 rounded-none border-b-2 " +
            (it.key === active
              ? "text-accent-strong bg-accent-soft border-accent"
              : "text-muted bg-transparent border-transparent hover:text-text")
          }
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}
