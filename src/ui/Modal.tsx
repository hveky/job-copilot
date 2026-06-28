import type { ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  title?: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  /** 顶栏右侧附加内容（关闭按钮始终在最右） */
  headerExtra?: ReactNode;
  /** 底部固定操作区 */
  footer?: ReactNode;
  /** 顶栏与内容之间的固定区（如健康状态 pills） */
  banner?: ReactNode;
  width?: number;
  closeOnMask?: boolean;
  className?: string;
  children: ReactNode;
}

/** 大尺寸分组弹窗：固定顶栏 + 可滚动内容 + 固定底部操作区。 */
export function Modal({
  title,
  description,
  onClose,
  headerExtra,
  footer,
  banner,
  width = 560,
  closeOnMask = true,
  className = "",
  children,
}: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.5)] backdrop-blur-[3px] p-6"
      onClick={closeOnMask ? onClose : undefined}
    >
      <div
        className={
          "flex flex-col bg-surface border border-border rounded-lg shadow-pop overflow-hidden " +
          className
        }
        style={{ width, maxWidth: "94vw", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || headerExtra) && (
          <header className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="m-0 text-[18px] leading-6 font-bold text-text">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 mb-0 text-aux text-text-2">{description}</p>
              )}
            </div>
            {headerExtra}
            <button
              className="icon-btn ghost"
              onClick={onClose}
              title="关闭"
              aria-label="关闭"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </header>
        )}
        {banner && <div className="shrink-0">{banner}</div>}
        <div className="flex-1 overflow-auto min-h-0">{children}</div>
        {footer && (
          <footer className="flex items-center gap-2 px-6 py-3.5 border-t border-border bg-surface shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
