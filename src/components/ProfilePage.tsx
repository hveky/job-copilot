import { FileText, ScrollText } from "lucide-react";
import { Button } from "../ui";
import type { GatewayConfig } from "../gateway/types";
import { InstructionPanel } from "./InstructionPanel";

export function ProfilePage(props: {
  resumeText: string;
  instruction: string;
  gateway: GatewayConfig;
  onInstructionChange: (value: string) => void;
  onOpenResume: () => void;
}) {
  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.3fr)]">
      <section className="overflow-hidden rounded border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <header className="flex items-center gap-2 border-b border-border px-5 py-4">
          <FileText size={18} strokeWidth={1.75} className="text-accent-strong" />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[16px] font-bold leading-6 text-text">个人简历</h2>
            <p className="m-0 text-[12px] leading-5 text-text-2">用于岗位评分、内容包和回复助手的个人背景来源。</p>
          </div>
          <Button variant="secondary" size="sm" onClick={props.onOpenResume}>编辑简历</Button>
        </header>
        <div className="max-h-[calc(100vh-190px)] overflow-auto p-5">
          {props.resumeText.trim() ? (
            <pre className="m-0 whitespace-pre-wrap rounded border border-border bg-[#F8FAFC] p-4 text-[13px] leading-6 text-text">{props.resumeText}</pre>
          ) : (
            <div className="rounded border border-dashed border-border bg-[#F8FAFC] p-6 text-[13px] leading-6 text-text-2">
              暂未读取到简历。可通过上方按钮整理或导入简历，保存后会自动用于 AI 评分与生成。
            </div>
          )}
        </div>
      </section>

      <section className="flex min-h-[620px] overflow-hidden rounded border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <ScrollText size={18} strokeWidth={1.75} className="text-accent-strong" />
            <div>
              <h2 className="m-0 text-[16px] font-bold leading-6 text-text">Instruction</h2>
              <p className="m-0 text-[12px] leading-5 text-text-2">常驻偏好、禁用表述、量化要求和目标赛道。</p>
            </div>
          </div>
          <InstructionPanel
            value={props.instruction}
            onChange={props.onInstructionChange}
            gateway={props.gateway}
            resume={props.resumeText}
          />
        </div>
      </section>
    </div>
  );
}
