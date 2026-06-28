import { CircleStop, Pause, ShieldCheck } from "lucide-react";
import { Button, StatusPill } from "../ui";

export function ApplyQuotaCard(props: {
  todayApplied: number;
  dailyCap: number;
  totalApplied: number;
}) {
  const pct = props.dailyCap > 0 ? Math.min(100, Math.round((props.todayApplied / props.dailyCap) * 1000) / 10) : 0;
  return (
    <section className="rounded border border-border bg-surface p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h3 className="m-0 text-[14px] font-bold leading-5 text-text">投递配额（BOSS）</h3>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-4">
        <div>
          <div className="text-[12px] font-medium leading-4 text-text-2">今日配额</div>
          <div className="mt-2 text-[28px] font-bold leading-[34px] text-accent-strong">
            {props.todayApplied}<span className="text-[18px] font-semibold text-text-2"> / {props.dailyCap}</span>
          </div>
          <div className="text-[12px] leading-4 text-text-2">今日已投</div>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
              <i className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-[11px] text-muted">{pct}%</span>
          </div>
        </div>
        <div className="h-full w-px bg-border" />
        <div>
          <div className="text-[12px] font-medium leading-4 text-text-2">累计已投</div>
          <div className="mt-2 text-[28px] font-bold leading-[34px] text-accent-strong">{props.totalApplied}</div>
          <div className="text-[12px] leading-4 text-text-2">历史总计</div>
        </div>
      </div>
    </section>
  );
}

export function RiskControlCard(props: {
  dailyCap: number;
  delayMin: number;
  delayMax: number;
  todayApplied: number;
}) {
  return (
    <section className="rounded border border-border bg-surface p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <h3 className="m-0 flex-1 text-[14px] font-bold leading-5 text-text">安全控制</h3>
        <StatusPill tone="accent" icon={<ShieldCheck size={13} strokeWidth={1.75} />}>低风险</StatusPill>
      </div>
      <div className="mt-4 space-y-2 text-[13px] leading-5">
        <ControlRow label="防风控间隔" value={`${props.delayMin} - ${props.delayMax} 秒`} action="编辑" />
        <ControlRow label="单日上限" value={`${props.dailyCap} 个岗位`} side={`已投 ${props.todayApplied} 个`} />
        <ControlRow label="每日随机休眠" value="2 - 5 分钟（每 1 小时）" side="已启用" />
        <ControlRow label="投递策略" value="顺序投递（低频稳健）" action="编辑" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" icon={<Pause size={16} strokeWidth={1.75} />} title="暂停当前投递流程">
          暂停投递
        </Button>
        <Button variant="danger" icon={<CircleStop size={16} strokeWidth={1.75} />} title="停止当前投递流程">
          停止投递
        </Button>
      </div>
    </section>
  );
}

function ControlRow(props: { label: string; value: string; side?: string; action?: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr_auto] items-center gap-2">
      <span className="text-text-2">{props.label}</span>
      <span className="truncate font-medium text-text">{props.value}</span>
      {props.action ? (
        <button type="button" className="ghost small h-7 px-2 text-[12px]" title={props.action}>
          {props.action}
        </button>
      ) : (
        <span className="whitespace-nowrap text-[12px] text-text-2">{props.side}</span>
      )}
    </div>
  );
}
