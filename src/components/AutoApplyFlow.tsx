import { CheckCircle, Info, LoaderCircle } from "lucide-react";

export type AutoApplyStep = "target" | "fetch" | "score" | "apply";

const STEPS: Array<{
  key: AutoApplyStep;
  index: number;
  title: string;
  description: string;
}> = [
  { key: "target", index: 1, title: "设定目标", description: "设置目标岗位、城市、薪资等" },
  { key: "fetch", index: 2, title: "抓取岗位", description: "从 BOSS 抓取相关岗位" },
  { key: "score", index: 3, title: "匹配评分", description: "AI 评分，筛选高匹配岗位" },
  { key: "apply", index: 4, title: "安全投递", description: "按策略自动投递并记录" },
];

function getState(step: AutoApplyStep, current: AutoApplyStep) {
  const currentIndex = STEPS.find((s) => s.key === current)?.index ?? 1;
  const ownIndex = STEPS.find((s) => s.key === step)?.index ?? 1;
  if (ownIndex < currentIndex) return "done";
  if (ownIndex === currentIndex) return "active";
  return "pending";
}

export function AutoApplyFlow(props: { current: AutoApplyStep }) {
  return (
    <section className="rounded border border-border bg-surface p-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="m-0 text-[18px] font-bold leading-7 text-text">自动投递流程</h2>
        <Info size={15} strokeWidth={1.75} className="text-muted" />
      </div>
      <div className="grid gap-3 xl:grid-cols-4">
        {STEPS.map((step) => {
          const state = getState(step.key, props.current);
          const isDone = state === "done";
          const isActive = state === "active";
          return (
            <div
              key={step.key}
              className={
                "relative min-h-[96px] overflow-hidden rounded-[10px] border bg-surface px-5 py-4 xl:[clip-path:polygon(0_0,calc(100%-24px)_0,100%_50%,calc(100%-24px)_100%,0_100%,16px_50%)] " +
                (isDone
                  ? "border-[#6EE7C8] bg-[#F8FFFC]"
                  : isActive
                    ? "border-[#60A5FA] bg-gradient-to-r from-white to-[#F8FBFF]"
                    : "border-border")
              }
            >
              <div className="flex items-start gap-4">
                <span
                  className={
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold " +
                    (isDone
                      ? "bg-accent text-white"
                      : isActive
                        ? "bg-[#1D6FEA] text-white"
                        : "bg-[#E5E7EB] text-text")
                  }
                >
                  {step.index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="m-0 text-[15px] font-bold leading-[22px] text-text">{step.title}</h3>
                    {isDone && <CheckCircle size={18} strokeWidth={1.9} className="ml-auto text-accent-strong" />}
                    {isActive && <LoaderCircle size={17} strokeWidth={1.75} className="ml-auto spin text-[#1D6FEA]" />}
                  </div>
                  <p className="mt-2 mb-0 text-[12px] leading-4 text-text-2">{step.description}</p>
                  <p className="mt-3 mb-0 text-[12px] leading-4 text-text-2">
                    {isDone ? "已完成" : isActive ? "进行中" : "待开始"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
