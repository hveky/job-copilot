import {
  FileText,
  Settings as SettingsIcon,
  PanelRightOpen,
  PanelRightClose,
  AlertTriangle,
} from "lucide-react";
import { StatusPill } from "../ui";

const ICON = { size: 20, strokeWidth: 1.75 } as const;

export function Header(props: {
  statusLabel: string;
  hasKey: boolean;
  sidebarOpen: boolean;
  onOpenResume: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface shadow-topbar">
      <div className="mx-auto flex h-full max-w-shell items-center gap-3 px-6">
        {/* 品牌 */}
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />
          <span className="text-[17px] font-bold tracking-[0.2px] text-text">
            求职作战助手
          </span>
        </div>

        {/* 状态 pill */}
        <StatusPill tone="neutral" className="hidden md:inline-flex">
          {props.statusLabel}
        </StatusPill>

        <span className="flex-1" />

        {!props.hasKey && (
          <StatusPill
            tone="warn"
            icon={<AlertTriangle size={14} strokeWidth={2} />}
            className="hidden sm:inline-flex"
          >
            未配置 DeepSeek Key
          </StatusPill>
        )}

        <button
          className="icon-btn ghost"
          title="简历编辑器"
          aria-label="简历编辑器"
          onClick={props.onOpenResume}
        >
          <FileText {...ICON} />
        </button>
        <button
          className="icon-btn ghost"
          title="设置"
          aria-label="设置"
          onClick={props.onOpenSettings}
        >
          <SettingsIcon {...ICON} />
        </button>
        <button
          className="icon-btn ghost"
          title={props.sidebarOpen ? "折叠右侧助手" : "展开右侧助手"}
          aria-label="切换右侧助手"
          onClick={props.onToggleSidebar}
        >
          {props.sidebarOpen ? (
            <PanelRightClose {...ICON} />
          ) : (
            <PanelRightOpen {...ICON} />
          )}
        </button>
      </div>
    </header>
  );
}
