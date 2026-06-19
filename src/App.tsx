import { useMemo, useState } from "react";
import { ContentPanel } from "./components/ContentPanel";
import { Copilot } from "./components/Copilot";
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

  const gateway = useMemo(() => toGatewayConfig(settings), [settings]);
  const hasKey = !!settings.dsKey;

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
          />
        </main>

        <aside className="sidebar">
          <div className="sb-tabs">
            <button className="active">回复助手</button>
          </div>
          <Copilot
            gateway={gateway}
            trackId={trackId}
            jd={jd}
            resume={settings.resume}
          />
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
