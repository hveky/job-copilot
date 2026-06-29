import type { ReactNode } from "react";
import { ShieldAlert, Gauge, Sparkles } from "lucide-react";
import { Modal, Button } from "../ui";

function Point(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 text-accent">{props.icon}</div>
      <div className="min-w-0">
        <div className="font-semibold text-text">{props.title}</div>
        <p className="mt-1 mb-0 text-aux text-text-2 leading-6">{props.body}</p>
      </div>
    </div>
  );
}

/** 首次启动的免责声明，仅在 settings.disclaimerAccepted 为 false 时渲染。 */
export function DisclaimerModal(props: { onAccept: () => void }) {
  return (
    <Modal
      title="使用前必读"
      description="第一次使用请先了解以下几点"
      width={520}
      closeOnMask={false}
      onClose={props.onAccept}
      footer={
        <Button variant="primary" className="ml-auto" onClick={props.onAccept}>
          我已知晓，开始使用
        </Button>
      }
    >
      <div className="px-6 py-5 flex flex-col gap-5">
        <Point
          icon={<ShieldAlert size={20} strokeWidth={1.75} />}
          title="免责声明"
          body="本工具仅作求职辅助，所有投递与 AI 生成的内容请自行核对后再使用，由此产生的一切后果由使用者自行承担。"
        />
        <Point
          icon={<Gauge size={20} strokeWidth={1.75} />}
          title="每天建议投 30 份"
          body="投递过多容易被平台判定为异常行为，请控制好节奏，宁可少而精。"
        />
        <Point
          icon={<Sparkles size={20} strokeWidth={1.75} />}
          title="能力第一"
          body="这个项目只是辅助你求职，最关键的还是要提升个人能力。"
        />
      </div>
    </Modal>
  );
}
