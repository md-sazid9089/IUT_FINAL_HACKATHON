import { useHardwareStore } from '../hardware/hardwareStore';

export function HardwarePanel() {
  const status = useHardwareStore((s) => s.status);
  const connectDisabled = useHardwareStore((s) => s.connectDisabled);

  return (
    <section className="panel">
      <h2>Hardware PoC</h2>
      <p className="muted small">Simulation is default. Browser never drives servos directly.</p>

      <div className="readout">
        <div className="readout-label">Mode</div>
        <div className="readout-value mono">{status.mode}</div>
      </div>
      <div className="readout">
        <div className="readout-label">Connection</div>
        <div className="readout-value mono">
          {status.state} · protocol {status.protocolVersion}
        </div>
      </div>
      <div className="readout">
        <div className="readout-label">Device / heartbeat</div>
        <div className="readout-value mono">
          {status.deviceId ?? 'none'} · {status.heartbeatOk ? 'ok' : 'not active'}
        </div>
      </div>
      <div className="readout">
        <div className="readout-label">Calibration</div>
        <div className="readout-value mono">{status.calibrationStatus}</div>
      </div>
      {status.communicationFault ? <p className="fail-row small">{status.communicationFault}</p> : null}
      <button onClick={() => void connectDisabled()}>Check disabled transport</button>
    </section>
  );
}
