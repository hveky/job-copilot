import { useEffect, useMemo, useRef, useState } from "react";
import { BossPanel } from "./components/BossPanel";
import { ContentPanel } from "./components/ContentPanel";
import { Copilot } from "./components/Copilot";
import { FilesPanel } from "./components/FilesPanel";
import { InstructionPanel } from "./components/InstructionPanel";
import { JobPicker } from "./components/JobPicker";
import { SettingsModal } from "./components/Settings";
import {
  loadSettings,
  saveSettings,
  toGatewayConfig,
  type Settings,
} from "./state/settings";

type SbTab = "copilot" | "instruction" | "files";

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [jd, setJd] = useState("");
  const [sbTab, setSbTab] = useState<SbTab>("copilot");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sbWidth, setSbWidth] = useState(settings.sidebarWidth);
  const widthRef = useRef(settings.sidebarWidth);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      const w = Math.min(760, Math.max(320, window.innerWidth - ev.clientX));
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
            resume={settings.resume}
            targetJobs={settings.targetJobs}
            activeJob={settings.activeJob}
            city={settings.city}
            onJobsChange={(targetJobs) => patch({ targetJobs })}
            onActiveChange={(activeJob) => patch({ activeJob })}
            onCityChange={(city) => patch({ city })}
          />
          <BossPanel
            gateway={gateway}
            job={settings.activeJob}
            city={settings.city}
            resume={settings.resume}
            instruction={settings.instruction}
            dailyCap={settings.dailyCap}
            delayMin={settings.delayMin}
            delayMax={settings.delayMax}
            feishuAppId={settings.feishuAppId}
            feishuAppSecret={settings.feishuAppSecret}
            feishuUserToken={settings.feishuUserToken}
            feishuBaseToken={settings.feishuBaseToken}
            feishuTableId={settings.feishuTableId}
            onPickJd={setJd}
          />
          <ContentPanel
            gateway={gateway}
            job={settings.activeJob}
            city={settings.city}
            jd={jd}
            onJdChange={setJd}
            resume={settings.resume}
            instruction={settings.instruction}
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
                resume={settings.resume}
                instruction={settings.instruction}
              />
            )}
            {sbTab === "instruction" && (
              <InstructionPanel
                value={settings.instruction}
                onChange={(instruction) => patch({ instruction })}
              />
            )}
            {sbTab === "files" && (
              <FilesPanel
                gateway={gateway}
                workspaceDir={settings.workspaceDir}
                instruction={settings.instruction}
                onSetWorkspace={(workspaceDir) => patch({ workspaceDir })}
              />
            )}
          </aside>
        )}
      </div>

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
