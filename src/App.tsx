import { useEffect, useMemo, useState } from "react";
import { BossPanel } from "./components/BossPanel";
import { ContentPanel } from "./components/ContentPanel";
import { Copilot } from "./components/Copilot";
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

      <div className={"body" + (sidebarOpen ? "" : " collapsed")}>
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
              <div className="chat" style={{ justifyContent: "center" }}>
                <div className="hint" style={{ textAlign: "center" }}>
                  「文件」需要桌面版(Tauri)才能读写本地求职工作区。
                  <br />
                  <br />
                  届时这里会显示 resume / talk / jds 文件树,
                  <br />
                  AI 用读/写/列工具直接帮你改简历话术。
                  <br />
                  <br />
                  <span className="tier-pill">敬请期待 · M2</span>
                </div>
              </div>
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
