import { BriefcaseBusiness, MapPin, BadgeDollarSign } from "lucide-react";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex min-w-[84px] flex-col items-center rounded bg-surface-2 border border-border px-4 py-3">
      <span className="text-[28px] leading-9 font-bold text-accent-strong">
        {value}
      </span>
      <span className="text-aux text-text-2">{label}</span>
    </div>
  );
}

/** 工作台顶部总览卡：一句话定位 + 当前目标 chips + 本日关键指标。 */
export function HeroSummaryCard(props: {
  activeJob: string;
  city: string;
  salary: string;
  todayApplied: number;
  totalApplied: number;
  candidates: number;
}) {
  const facts = [
    { icon: <BriefcaseBusiness size={16} strokeWidth={1.75} />, text: props.activeJob || "未选目标岗位" },
    { icon: <MapPin size={16} strokeWidth={1.75} />, text: props.city || "未选城市" },
    { icon: <BadgeDollarSign size={16} strokeWidth={1.75} />, text: props.salary || "薪资不限" },
  ];
  return (
    <section className="mb-4 rounded bg-surface border border-border shadow-card p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-[24px] leading-8 font-bold text-text">
            从岗位筛选到沟通回复，一站式求职作战台
          </h1>
          <p className="mt-2 mb-3 text-body text-text-2">
            围绕当前目标推进投递与沟通，内容生成与回复助手随时待命。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {facts.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-border px-3 py-1 text-aux text-text-2"
              >
                <span className="text-accent-strong">{f.icon}</span>
                {f.text}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          <Metric label="今日已投" value={props.todayApplied} />
          <Metric label="累计投递" value={props.totalApplied} />
          <Metric label="候选岗位" value={props.candidates} />
        </div>
      </div>
    </section>
  );
}
