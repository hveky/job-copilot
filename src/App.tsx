import { useMemo, useState } from "react";
import { ContentPanel } from "./components/ContentPanel";
import { Copilot } from "./components/Copilot";
import { InstructionPanel } from "./components/InstructionPanel";
import { SettingsModal } from "./components/Settings";
import {
  loadSettings,
  saveSettings,
  toGatewayConfig,
  type Settings,
} from "./state/settings";

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [trackId, setTrackId] = useState("ai");
  const [jd, setJd] = useState("");
  const [sbTab, setSbTab] = useState<"copilot" | "instruction">("copilot");

  const gateway = useMemo(() => toGatewayConfig(settings), [settings]);
  const hasKey = !!settings.dsKey;

  function onSave(s: Settings) {
    setSettings(s);
    saveSettings(s);
    setShowSettings(false);
  }

  function setInstruction(instruction: string) {
    const s = { ...settings, instruction };
    setSettings(s);
    saveSettings(s);
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
        <button className="small" onClick={() => setShowSettings(true)}>
          设置
        </button>
      </header>

      <div className="body">
        <main className="main">
          <ContentPanel
            gateway={gateway}
            trackId={trackId}
            onTrackChange={setTrackId}
            jd={jd}
            onJdChange={setJd}
            resume={settings.resume}
            instruction={settings.instruction}
          />
        </main>

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
          </div>
          {sbTab === "copilot" ? (
            <Copilot
              gateway={gateway}
              trackId={trackId}
              jd={jd}
              resume={settings.resume}
              instruction={settings.instruction}
            />
          ) : (
            <InstructionPanel
              value={settings.instruction}
              onChange={setInstruction}
            />
          )}
        </aside>
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
