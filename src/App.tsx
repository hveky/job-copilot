import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, ScrollText, FolderClosed } from "lucide-react";
import { Header } from "./components/Header";
import { WorkflowRail, type WorkflowStep } from "./components/WorkflowRail";
import { HeroSummaryCard } from "./components/HeroSummaryCard";
import { BossPanel } from "./components/BossPanel";
import { ContentPanel } from "./components/ContentPanel";
import { Copilot } from "./components/Copilot";
import { FilesPanel } from "./components/FilesPanel";
import { InstructionPanel } from "./components/InstructionPanel";
import { JobInbox } from "./components/JobInbox";
import { JobPicker } from "./components/JobPicker";
import { ResumeOnboard } from "./components/ResumeOnboard";
import { SettingsModal } from "./components/Settings";
import { ResumeBuilderModal } from "./components/ResumeBuilderModal";
import { Tabs } from "./ui";
import { getDaily, loadApplied } from "./lib/ledger";
import {
  loadSettings,
  saveSettings,
  toGatewayConfig,
  type Settings,
} from "./state/settings";
import { BUILTIN_FEISHU } from "./config/feishu";
import {
  bridgeToken,
  dataRoot,
  fsWrite,
  isDesktop,
  listenJobsReceived,
  readResume,
} from "./lib/tauri";
import { sidebar as SB } from "./design/tokens";

type SbTab = "copilot" | "instruction" | "files";

const SB_TABS = [
  { key: "copilot" as const, label: "回复助手", icon: <MessageSquare size={16} strokeWidth={1.75} /> },
  { key: "instruction" as const, label: "Instruction", icon: <ScrollText size={16} strokeWidth={1.75} /> },
  { key: "files" as const, label: "文件", icon: <FolderClosed size={16} strokeWidth={1.75} /> },
];

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [jd, setJd] = useState("");
  const [sbTab, setSbTab] = useState<SbTab>("copilot");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768,
  );
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [sbWidth, setSbWidth] = useState(settings.sidebarWidth);
  const widthRef = useRef(settings.sidebarWidth);

  // 窄屏(<768)：右侧助手默认折叠，展开时以抽屉(overlay)形式出现，主区不被挤压
  useEffect(() => {
    const onResize = () => {
      const isNarrow = window.innerWidth < 768;
      setNarrow(isNarrow);
      if (isNarrow) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 文件优先:固定数据根目录 + 简历从 resumes/ 读取
  const [root, setRoot] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [needResume, setNeedResume] = useState(false);
  const [fileToOpen, setFileToOpen] = useState("");
  // BOSS 扩展推送岗位时自增,触发收件箱刷新
  const [inboxKey, setInboxKey] = useState(0);
  // 总览指标
  const [candidates, setCandidates] = useState(0);
  const [metricsKey, setMetricsKey] = useState(0);

  const todayApplied = useMemo(() => getDaily(), [metricsKey]);
  const totalApplied = useMemo(() => loadApplied().size, [metricsKey, inboxKey]);

  async function refreshResume(r: string) {
    if (!r) return;
    try {
      const { text, count } = await readResume(r);
      setResumeText(text);
      if (count === 0) setNeedResume(true);
    } catch {
      /* ignore */
    }
  }

  // 启动:取固定根目录(桌面),建好的四个文件夹由 Rust 保证存在,然后载入简历
  useEffect(() => {
    if (!isDesktop()) return;
    (async () => {
      try {
        const r = await dataRoot();
        setRoot(r);
        const token = await bridgeToken();
        patch({ bridgeToken: token });
        await refreshResume(r);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 订阅 BOSS 扩展的入站推送:收到就让收件箱刷新
  useEffect(() => {
    let un: (() => void) | undefined;
    listenJobsReceived(() => setInboxKey((k) => k + 1)).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  async function onSubmitResume(text: string) {
    await fsWrite(root, "resumes/resume.md", text);
    setNeedResume(false);
    await refreshResume(root);
    setSbTab("files");
    setFileToOpen("resumes/resume.md");
  }

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      const upper = Math.min(SB.maxWidth, Math.max(SB.minWidth, window.innerWidth - 360));
      const w = Math.min(upper, Math.max(SB.minWidth, window.innerWidth - ev.clientX));
      widthRef.current = w;
      setSbWidth(w);
    };
    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      patch({ sidebarWidth: widthRef.current });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const gateway = useMemo(() => toGatewayConfig(settings), [settings]);
  const hasKey = !!settings.dsKey;

  function patch(p: Partial<Settings>) {
    setSettings((cur) => {
      const next = { ...cur, ...p };
      saveSettings(next);
      return next;
    });
  }

  function onSave(s: Settings) {
    setSettings(s);
    saveSettings(s);
    setShowSettings(false);
  }

  // 内容包生成完毕 → 跳到「文件」面板并打开该文件
  function onGenerated(path: string) {
    setSidebarOpen(true);
    setSbTab("files");
    setFileToOpen(path);
  }

  const workflowStep: WorkflowStep = !settings.activeJob
    ? "filter"
    : !jd.trim()
      ? "fetch"
      : "generate";

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <Header
        statusLabel="M1 · 内容生成 + 回复助手"
        hasKey={hasKey}
        sidebarOpen={sidebarOpen}
        onOpenResume={() => setShowResume(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="mx-auto flex w-full max-w-shell min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto px-6 py-5">
          <HeroSummaryCard
            activeJob={settings.activeJob}
            city={settings.city}
            salary={settings.salary}
            todayApplied={todayApplied}
            totalApplied={totalApplied}
            candidates={candidates}
          />
          <WorkflowRail current={workflowStep} />

          <JobPicker
            gateway={gateway}
            resume={resumeText}
            targetJobs={settings.targetJobs}
            activeJob={settings.activeJob}
            jobHistory={settings.jobHistory}
            cities={settings.cities}
            city={settings.city}
            salary={settings.salary}
            onJobsChange={(targetJobs) => patch({ targetJobs })}
            onActiveChange={(activeJob) => patch({ activeJob })}
            onHistoryChange={(jobHistory) => patch({ jobHistory })}
            onCitiesChange={(cities) => patch({ cities })}
            onCityChange={(city) => patch({ city })}
            onSalaryChange={(salary) => patch({ salary })}
          />
          <BossPanel
            gateway={gateway}
            job={settings.activeJob}
            city={settings.city}
            salary={settings.salary}
            resume={resumeText}
            instruction={settings.instruction}
            dailyCap={settings.dailyCap}
            delayMin={settings.delayMin}
            delayMax={settings.delayMax}
            feishuAppId={settings.feishuAppId || BUILTIN_FEISHU.clientId}
            feishuAppSecret={settings.feishuAppSecret || BUILTIN_FEISHU.clientSecret}
            feishuUserToken={settings.feishuUserToken}
            feishuBaseToken={settings.feishuBaseToken}
            feishuTableId={settings.feishuTableId}
            root={root}
            onPickJd={setJd}
            onApplied={() => setMetricsKey((k) => k + 1)}
          />
          <JobInbox
            root={root}
            refreshKey={inboxKey}
            onUseJd={setJd}
            onUseJob={(t) => patch({ activeJob: t })}
            onCount={setCandidates}
          />
          <ContentPanel
            gateway={gateway}
            job={settings.activeJob}
            city={settings.city}
            jd={jd}
            onJdChange={setJd}
            resume={resumeText}
            instruction={settings.instruction}
            root={root}
            onGenerated={onGenerated}
          />
        </main>

        {sidebarOpen && !narrow && (
          <div
            className="w-1.5 cursor-col-resize bg-border transition-colors hover:bg-accent"
            onMouseDown={startDrag}
            title="拖拽调整助手宽度"
          />
        )}

        {sidebarOpen && narrow && (
          <div
            className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.4)]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {sidebarOpen && (
          <aside
            className={
              "flex min-h-0 flex-col border-l border-border bg-surface shrink-0 " +
              (narrow ? "fixed inset-y-0 right-0 z-40 shadow-pop" : "")
            }
            style={{ width: narrow ? Math.min(sbWidth, window.innerWidth * 0.92) : sbWidth }}
          >
            <Tabs
              items={SB_TABS}
              active={sbTab}
              onChange={setSbTab}
              variant="underline"
            />
            {sbTab === "copilot" && (
              <Copilot
                gateway={gateway}
                job={settings.activeJob}
                jd={jd}
                resume={resumeText}
                instruction={settings.instruction}
              />
            )}
            {sbTab === "instruction" && (
              <InstructionPanel
                value={settings.instruction}
                onChange={(instruction) => patch({ instruction })}
                gateway={gateway}
                resume={resumeText}
              />
            )}
            {sbTab === "files" && (
              <FilesPanel
                gateway={gateway}
                root={root}
                instruction={settings.instruction}
                fileToOpen={fileToOpen}
                onFileOpened={() => setFileToOpen("")}
                onFilesChanged={() => refreshResume(root)}
              />
            )}
          </aside>
        )}
      </div>

      {needResume && root && (
        <ResumeOnboard
          onSubmit={onSubmitResume}
          onSkip={() => setNeedResume(false)}
        />
      )}

      {showResume && root && (
        <ResumeBuilderModal
          gateway={gateway}
          root={root}
          resumeText={resumeText}
          onClose={() => {
            setShowResume(false);
            refreshResume(root);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          initial={settings}
          onSave={onSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
