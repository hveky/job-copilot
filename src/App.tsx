import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  loadSettings,
  saveSettings,
  toGatewayConfig,
  type Settings,
} from "./state/settings";
import { BUILTIN_FEISHU } from "./config/feishu";
import {
  dataRoot,
  fsWrite,
  isDesktop,
  listenJobsReceived,
  readResume,
} from "./lib/tauri";

type SbTab = "copilot" | "instruction" | "files";

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [jd, setJd] = useState("");
  const [sbTab, setSbTab] = useState<SbTab>("copilot");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sbWidth, setSbWidth] = useState(settings.sidebarWidth);
  const widthRef = useRef(settings.sidebarWidth);

  // 文件优先:固定数据根目录 + 简历从 resumes/ 读取
  const [root, setRoot] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [needResume, setNeedResume] = useState(false);
  const [fileToOpen, setFileToOpen] = useState("");
  // BOSS 扩展推送岗位时自增,触发收件箱刷新
  const [inboxKey, setInboxKey] = useState(0);

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
      // 下限 300;上限取 760 与「窗口宽 - 360(留给主区)」的较小值,窄窗下主区不被挤没
      const upper = Math.min(760, Math.max(300, window.innerWidth - 360));
      const w = Math.min(upper, Math.max(300, window.innerWidth - ev.clientX));
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

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

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

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">求职作战助手</span>
        <span className="badge">M1 · 内容生成 + 回复助手</span>
        <span className="spacer" />
        {!hasKey && (
          <span className="badge" style={{ color: "var(--warn)" }}>
            ⚠ 未配置 DeepSeek Key
          </span>
        )}
        <button
          className="small"
          title="切换浅色 / 深色"
          onClick={() =>
            patch({ theme: settings.theme === "dark" ? "light" : "dark" })
          }
        >
          {settings.theme === "dark" ? "浅色" : "深色"}
        </button>
        <button className="small" onClick={() => setShowResume(true)}>
          简历
        </button>
        <button className="small" onClick={() => setShowSettings(true)}>
          设置
        </button>
        <button
          className="small"
          title={sidebarOpen ? "折叠右侧边栏" : "展开右侧边栏"}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          {sidebarOpen ? "» 边栏" : "« 边栏"}
        </button>
      </header>

      <div
        className={"body" + (sidebarOpen ? "" : " collapsed")}
        style={
          sidebarOpen
            ? { gridTemplateColumns: `minmax(0,1fr) 6px ${sbWidth}px` }
            : undefined
        }
      >
        <main className="main">
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
          />
          <JobInbox
            root={root}
            refreshKey={inboxKey}
            onUseJd={setJd}
            onUseJob={(t) => patch({ activeJob: t })}
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

        {sidebarOpen && (
          <div className="divider" onMouseDown={startDrag} title="拖拽调整边栏宽度" />
        )}

        {sidebarOpen && (
          <aside className="sidebar">
            <div className="sb-tabs">
              <button
                className={sbTab === "copilot" ? "active" : ""}
                onClick={() => setSbTab("copilot")}
              >
                回复助手
              </button>
              <button
                className={sbTab === "instruction" ? "active" : ""}
                onClick={() => setSbTab("instruction")}
              >
                Instruction
              </button>
              <button
                className={sbTab === "files" ? "active" : ""}
                onClick={() => setSbTab("files")}
              >
                文件
              </button>
            </div>
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
          onClose={() => { setShowResume(false); refreshResume(root); }}
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
