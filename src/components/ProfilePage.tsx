import { FileText, ScrollText } from "lucide-react";
import { Button } from "../ui";
import type { GatewayConfig } from "../gateway/types";
import { InstructionPanel } from "./InstructionPanel";

export function ProfilePage(props: {
  resumeText: string;
  resumeImageCount: number;
  resumeImages: { path: string; name: string; url: string }[];
  resumeImportNotice?: string;
  instruction: string;
  gateway: GatewayConfig;
  onInstructionChange: (value: string) => void;
  onOpenResume: () => void;
}) {
  const hasResumeText = props.resumeText.trim().length > 0;
  const hasResumeImages = props.resumeImageCount > 0;

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.3fr)]">
      <section className="overflow-hidden rounded border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <header className="flex items-center gap-2 border-b border-border px-5 py-4">
          <FileText size={18} strokeWidth={1.75} className="text-accent-strong" />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[16px] font-bold leading-6 text-text">个人简历</h2>
            <p className="m-0 text-[12px] leading-5 text-text-2">视觉简历用于查看与投递附图，AI 可读文本用于岗位评分、内容包和回复助手。</p>
          </div>
          <Button variant="secondary" size="sm" onClick={props.onOpenResume}>查看简历</Button>
        </header>
        <div className="max-h-[calc(100vh-190px)] overflow-auto p-5">
          {props.resumeImportNotice && (
            <div className="mb-3 rounded border border-accent bg-accent-soft p-3 text-[13px] leading-6 text-text">
              {props.resumeImportNotice}
            </div>
          )}

          {hasResumeImages ? (
            <section className="rounded border border-border bg-[#F8FAFC] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="m-0 text-[14px] font-semibold leading-5 text-text">视觉简历预览</h3>
                  <p className="m-0 text-[12px] leading-5 text-text-2">
                    共 {props.resumeImageCount} 张 PDF 页面图，保存在 resumes/，用于投递附图。
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={props.onOpenResume}>管理</Button>
              </div>
              {props.resumeImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {props.resumeImages.slice(0, 6).map((image) => (
                    <button
                      key={image.path}
                      type="button"
                      className="group min-w-0 rounded border border-border bg-white p-2 text-left transition-colors hover:border-accent"
                      onClick={props.onOpenResume}
                      title={image.path}
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="h-36 w-full rounded border border-border bg-white object-contain"
                      />
                      <span className="mt-2 block truncate text-[12px] leading-5 text-text-2 group-hover:text-accent-strong">
                        {image.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-border bg-white p-3 text-[12px] leading-5 text-text-2">
                  已检测到简历图文件，但缩略图读取失败。可点击管理查看文件状态。
                </div>
              )}
            </section>
          ) : !hasResumeText ? (
            <div className="rounded border border-dashed border-border bg-[#F8FAFC] p-6 text-[13px] leading-6 text-text-2">
              暂未读取到简历。可通过上方按钮整理或导入简历，保存后会自动用于 AI 评分与生成。
            </div>
          ) : null}

          {hasResumeText && (
            <section className={hasResumeImages ? "mt-4" : ""}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="m-0 text-[14px] font-semibold leading-5 text-text">AI 可读文本</h3>
                  <p className="m-0 text-[12px] leading-5 text-text-2">从 PDF 抽取或手动整理，用于 AI 评分与生成；不作为视觉简历排版预览。</p>
                </div>
              </div>
              <pre className="m-0 whitespace-pre-wrap rounded border border-border bg-[#F8FAFC] p-4 text-[13px] leading-6 text-text">{props.resumeText}</pre>
            </section>
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
