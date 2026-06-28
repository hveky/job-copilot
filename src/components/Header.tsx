import {
  AlertTriangle,
  BookOpen,
  Maximize2,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Rocket,
  Settings as SettingsIcon,
  Sun,
  X,
} from "lucide-react";
import { StatusPill } from "../ui";

const ICON = { size: 18, strokeWidth: 1.75 } as const;

export function Header(props: {
  statusLabel: string;
  hasKey: boolean;
  sidebarOpen: boolean;
  onOpenResume: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface shadow-topbar">
      <div className="flex h-full items-center gap-3 px-6">
        <div className="flex items-center gap-2.5">
          <Rocket size={20} strokeWidth={2} className="text-text" />
          <span className="text-[18px] font-bold leading-6 text-text">求职作战助手</span>
        </div>

        <StatusPill tone="accent" className="hidden px-2.5 py-1 sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-accent" />
          运行中
        </StatusPill>
        <StatusPill tone="neutral" className="hidden md:inline-flex">
          {props.statusLabel}
        </StatusPill>

        <span className="flex-1" />

        {!props.hasKey && (
          <StatusPill
            tone="warn"
            icon={<AlertTriangle size={14} strokeWidth={2} />}
            className="hidden lg:inline-flex"
          >
            未配置 DeepSeek Key
          </StatusPill>
        )}

        <button className="ghost inline-flex h-9 items-center gap-2 px-3" title="浅色主题" aria-label="浅色主题" type="button">
          <Sun {...ICON} />
          <span className="hidden text-[13px] font-medium lg:inline">浅色主题</span>
        </button>
        <button
          className="ghost inline-flex h-9 items-center gap-2 px-3"
          title="设置"
          aria-label="设置"
          type="button"
          onClick={props.onOpenSettings}
        >
          <SettingsIcon {...ICON} />
          <span className="hidden text-[13px] font-medium lg:inline">设置</span>
        </button>
        <button
          className="ghost inline-flex h-9 items-center gap-2 px-3"
          title="使用指南"
          aria-label="使用指南"
          type="button"
          onClick={props.onOpenResume}
        >
          <BookOpen {...ICON} />
          <span className="hidden text-[13px] font-medium lg:inline">使用指南</span>
        </button>
        <button
          className="icon-btn ghost"
          title={props.sidebarOpen ? "折叠右侧助手" : "展开右侧助手"}
          aria-label="切换右侧助手"
          type="button"
          onClick={props.onToggleSidebar}
        >
          {props.sidebarOpen ? <PanelRightClose {...ICON} /> : <PanelRightOpen {...ICON} />}
        </button>

        <span className="mx-1 hidden h-6 w-px bg-border lg:block" />
        <div className="hidden items-center gap-1 text-text-2 lg:flex">
          <button className="icon-btn ghost" type="button" title="最小化" aria-label="最小化"><Minus size={16} strokeWidth={1.75} /></button>
          <button className="icon-btn ghost" type="button" title="最大化" aria-label="最大化"><Maximize2 size={15} strokeWidth={1.75} /></button>
          <button className="icon-btn ghost" type="button" title="关闭" aria-label="关闭"><X size={16} strokeWidth={1.75} /></button>
        </div>
      </div>
    </header>
  );
}
