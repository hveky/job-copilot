import {
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  FileText,
  Grid2X2,
  Settings,
  UserRound,
} from "lucide-react";

export type NavView = "workbench" | "profile" | "records" | "templates" | "stats";

const NAV_ITEMS: Array<{
  key: NavView | "settings";
  label: string;
  icon: typeof Grid2X2;
  disabled?: boolean;
}> = [
  { key: "workbench", label: "工作台", icon: Grid2X2 },
  { key: "profile", label: "个人画像", icon: UserRound },
  { key: "records", label: "投递记录", icon: ClipboardList },
  { key: "templates", label: "内容模板", icon: FileText, disabled: true },
  { key: "stats", label: "数据统计", icon: ChartNoAxesColumnIncreasing, disabled: true },
  { key: "settings", label: "设置", icon: Settings },
];

export function LeftNavRail(props: {
  active?: NavView;
  onNavigate?: (view: NavView) => void;
  onOpenSettings?: () => void;
}) {
  const active = props.active ?? "workbench";

  return (
    <nav className="hidden w-20 shrink-0 border-r border-border bg-surface px-3 py-4 md:flex md:flex-col md:items-center md:gap-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        const clickable = item.key === "settings" ? !!props.onOpenSettings : !item.disabled;
        return (
          <button
            key={item.key}
            type="button"
            title={item.disabled ? `${item.label}（后续开放）` : item.label}
            aria-label={item.label}
            disabled={!clickable}
            onClick={() => {
              if (item.key === "settings") props.onOpenSettings?.();
              else if (!item.disabled) props.onNavigate?.(item.key);
            }}
            className={
              "flex h-16 w-14 flex-col items-center justify-center gap-1 rounded-[10px] border-0 p-0 text-[12px] leading-4 shadow-none " +
              (isActive
                ? "bg-[#DDF6EF] text-accent-strong"
                : item.disabled
                  ? "bg-transparent text-muted opacity-60"
                  : "bg-transparent text-text-2 hover:bg-surface-2 hover:text-text")
            }
          >
            <Icon size={22} strokeWidth={1.75} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}