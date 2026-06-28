import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, ScrollText, FolderClosed } from "lucide-react";
import { Header } from "./components/Header";
import { AutoApplyFlow, type AutoApplyStep } from "./components/AutoApplyFlow";
import { LeftNavRail } from "./components/LeftNavRail";
import { ApplyQuotaCard, RiskControlCard } from "./components/ApplySidebarCards";
import { BossPanel } from "./components/BossPanel";
import { ReplyWorkspace } from "./components/ReplyWorkspace";
import { FilesPanel } from "./components/FilesPanel";
import { InstructionPanel } from "./components/InstructionPanel";
import { JobPicker } from "./components/JobPicker";
import { ResumeOnboard } from "./components/ResumeOnboard";
import { SettingsModal } from "./components/Settings";
import { ResumeBuilderModal } from "./components/ResumeBuilderModal";
import { Tabs } from "./ui";
import { getDaily, loadRecords } from "./lib/ledger";
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
import { TaskStatusBar, type ApplyTaskStatus, type ContentTaskStatus } from "./components/TaskStatusBar";
import type { Tier } from "./gateway/types";

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
  const [contentTier, setContentTier] = useState<Tier>("deep");
  const [contentStatus, setContentStatus] = useState<ContentTaskStatus>({
    state: "idle",
    tier: "deep",
    model: settings.modelPro,
  });
  const [applyStatus, setApplyStatus] = useState<ApplyTaskStatus>({
    state: "idle",
    done: 0,
    total: 0,
  });
  const [sbTab, setSbTab] = useState<SbTab>("copilot");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768,
  );
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [sbWidth, setSbWidth] = useState(settings.sidebarWidth);
  const widthRef = useRef(settings.sidebarWidth);

  useEffect(() => {
    const onResize = () => {
      const isNarrow = window.innerWidth < 768;
      setNarrow(isNarrow);
      if (isNarrow) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [root, setRoot] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [needResume, setNeedResume] = useState(false);
  const [fileToOpen, setFileToOpen] = useState("");
  const [inboxKey, setInboxKey] = useState(0);
  const [candidates, setCandidates] = useState(0);
  const [metricsKey, setMetricsKey] = useState(0);

  const todayApplied = useMemo(() => getDaily(), [metricsKey]);
  const totalApplied = useMemo(() => loadRecords().length, [metricsKey]);

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

  function onGenerated(path: string) {
    setSidebarOpen(true);
    setSbTab("files");
    setFileToOpen(path);
    setContentStatus({ state: "done", tier: contentTier, model: contentTier === "deep" ? settings.modelPro : settings.modelFlash, path });
  }

  function onContentTierChange(tier: Tier) {
    setContentTier(tier);
    setContentStatus((cur) => ({
      ...cur,
      tier,
      model: tier === "deep" ? settings.modelPro : settings.modelFlash,
    }));
  }

  const autoStep: AutoApplyStep = !settings.activeJob
    ? "target"
    : applyStatus.state === "running" || applyStatus.state === "waiting"
      ? "apply"
      : candidates > 0
        ? "score"
        : "fetch";

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <Header
        statusLabel="M1 · 内容生成 · 回复助手"
        hasKey={hasKey}
        sidebarOpen={sidebarOpen}
        onOpenResume={() => setShowResume(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex min-h-0 w-full flex-1 bg-workbench">
        <LeftNavRail onOpenSettings={() => setShowSettings(true)} />

        <main className="min-w-0 flex-1 overflow-auto px-4 py-4 lg:px-[18px]">
          <div className="mx-auto grid max-w-none gap-3 xl:gap-4">
            <AutoApplyFlow current={autoStep} />

            <div className="grid gap-3 xl:grid-cols-[376px_minmax(0,1fr)] 2xl:grid-cols-[376px_minmax(0,1fr)]">
              <aside className="grid content-start gap-3">
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
                <ApplyQuotaCard
                  todayApplied={todayApplied}
                  dailyCap={settings.dailyCap}
                  totalApplied={totalApplied}
                />
                <RiskControlCard
                  todayApplied={todayApplied}
                  dailyCap={settings.dailyCap}
                  delayMin={settings.delayMin}
                  delayMax={settings.delayMax}
                />
              </aside>

              <section className="min-w-0">
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
                  inboxRefreshKey={inboxKey}
                  contentTier={contentTier}
                  onContentTierChange={onContentTierChange}
                  onPickJd={setJd}
                  onGenerated={onGenerated}
                  onCandidateCount={setCandidates}
                  onContentStatus={setContentStatus}
                  onApplyStatus={setApplyStatus}
                  onApplied={() => setMetricsKey((k) => k + 1)}
                />
              </section>
            </div>
          </div>
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
              <ReplyWorkspace
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

      <TaskStatusBar
        todayApplied={todayApplied}
        dailyCap={settings.dailyCap}
        candidates={candidates}
        content={{
          ...contentStatus,
          tier: contentTier,
          model: contentTier === "deep" ? settings.modelPro : settings.modelFlash,
        }}
        apply={applyStatus}
      />

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
