import { useEffect, useState } from 'react';
import { loadKeyConfig, type KeyConfig } from './config/keyConfig';
import { useRobotStore } from './state/robotStore';
import { SceneRoot } from './scene/SceneRoot';
import { TelemetryPanel } from './ui/TelemetryPanel';
import { FkDiagnosticsPanel } from './ui/FkDiagnosticsPanel';
import { RuntimePanel } from './ui/RuntimePanel';
import { JointDebugPanel } from './ui/JointDebugPanel';
import { IkPreflightPanel } from './ui/IkPreflightPanel';
import { StatusOverlay } from './ui/StatusOverlay';

const KEY_CONFIG_URL = '/config/key.config.json';

export function App() {
  const status = useRobotStore((s) => s.status);
  const error = useRobotStore((s) => s.error);

  const [keyConfig, setKeyConfig] = useState<KeyConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadKeyConfig(KEY_CONFIG_URL)
      .then((cfg) => {
        if (!cancelled) setKeyConfig(cfg);
      })
      .catch((err: unknown) => {
        if (!cancelled) setConfigError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>stylus_arm — Digital Twin</h1>
        <span className="subtitle">Gate 1 · URDF render · key panel · live telemetry</span>
      </header>

      <div className="app-body">
        <aside className="sidebar left">
          <RuntimePanel />
          <TelemetryPanel />
          <FkDiagnosticsPanel />
        </aside>

        <main className="viewport">
          <SceneRoot keyConfig={keyConfig} />
          <StatusOverlay status={status} error={error} configError={configError} />
        </main>

        <aside className="sidebar right">
          <JointDebugPanel />
          <IkPreflightPanel keyConfig={keyConfig} />
        </aside>
      </div>
    </div>
  );
}
