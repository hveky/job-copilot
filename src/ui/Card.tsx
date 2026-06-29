import type { ReactNode } from "react";

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

/** 统一模块容器：白底 + 1px 边框 + 8px 圆角 + 轻阴影。标题/描述/操作可选。 */
export function Card({
  title,
  description,
  action,
  icon,
  className = "",
  bodyClassName = "",
  children,
}: CardProps) {
  const hasHead = title || description || action;
  return (
    <section
      className={
        "rounded bg-surface border border-border shadow-card p-5 mb-4 " +
        className
      }
    >
      {hasHead && (
        <header className="flex items-start gap-3 mb-3">
          {icon && (
            <span className="mt-0.5 text-accent-strong shrink-0">{icon}</span>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="m-0 text-[14px] leading-5 font-semibold text-text">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 mb-0 text-aux text-text-2 leading-[18px]">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
