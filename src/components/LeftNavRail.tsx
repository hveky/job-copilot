import {
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  FileText,
  Grid2X2,
  Home,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "workbench", label: "工作台", icon: Grid2X2 },
  { key: "target", label: "目标岗位", icon: Home },
  { key: "records", label: "投递记录", icon: ClipboardList },
  { key: "templates", label: "内容模板", icon: FileText },
  { key: "stats", label: "数据统计", icon: ChartNoAxesColumnIncreasing },
  { key: "settings", label: "设置", icon: Settings },
] as const;

export function LeftNavRail(props: { active?: string; onOpenSettings?: () => void }) {
  const active = props.active ?? "workbench";

  return (
    <nav className="hidden w-20 shrink-0 border-r border-border bg-surface px-3 py-4 md:flex md:flex-col md:items-center md:gap-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        const clickable = item.key === "settings" && props.onOpenSettings;
        return (
          <button
            key={item.key}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={clickable ? props.onOpenSettings : undefined}
            className={
              "flex h-16 w-14 flex-col items-center justify-center gap-1 rounded-[10px] border-0 p-0 text-[12px] leading-4 shadow-none " +
              (isActive
                ? "bg-[#DDF6EF] text-accent-strong"
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
