import { useMemo, useRef, useState } from 'react';
import type { KeyConfig } from '../config/keyConfig';
import { getRuntime } from '../runtime/runtimeInstance';
import { useRobotStore } from '../state/robotStore';
import { PinCoordinator } from '../pin/PinCoordinator';
import { PIN_SEQUENCE_LENGTH } from '../pin/pinConfig';
import { exportPinReportCsv, exportPinReportJson } from '../pin/pinReports';
import { usePinStore } from '../pin/pinStore';
import { validatePin } from '../pin/pinValidation';

interface PinPanelProps {
  keyConfig: KeyConfig | null;
}

export function PinPanel({ keyConfig }: PinPanelProps) {
  const chain = useRobotStore((s) => s.chain);
  const pin = usePinStore((s) => s.pin);
  const state = usePinStore((s) => s.state);
  const plan = usePinStore((s) => s.plan);
  const report = usePinStore((s) => s.report);
  const error = usePinStore((s) => s.error);
  const activeDigitIndex = usePinStore((s) => s.activeDigitIndex);
  const activeKey = usePinStore((s) => s.activeKey);
  const stage = usePinStore((s) => s.stage);
  const setPin = usePinStore((s) => s.setPin);
  const resetPin = usePinStore((s) => s.resetPin);
  const [busy, setBusy] = useState(false);
  const coordinatorRef = useRef<PinCoordinator | null>(null);

  const validation = useMemo(
    () => (keyConfig ? validatePin(pin, keyConfig) : null),
    [keyConfig, pin],
  );

  function coordinator(): PinCoordinator {
    const runtime = getRuntime();
    if (!runtime || !chain || !keyConfig) throw new Error('Runtime, chain, or key config not ready');
    if (!coordinatorRef.current) {
      coordinatorRef.current = new PinCoordinator({ runtime, chain, keyConfig });
    }
    return coordinatorRef.current;
  }

  async function preflight() {
    setBusy(true);
    try {
      await coordinator().preflight(pin);
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    if (!plan) return;
    setBusy(true);
    try {
      await coordinator().execute(plan);
    } catch {
      // Failure state is already recorded in the PIN store.
    } finally {
      setBusy(false);
    }
  }

  function addDigit(digit: string) {
    if (pin.length < PIN_SEQUENCE_LENGTH) setPin(`${pin}${digit}`);
  }

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel pin-panel">
      <h2>Autonomous PIN</h2>
      <p className="muted small">Six keys only · explicit Preflight then Execute · runtime source: autonomous</p>

      <label className="field-label" htmlFor="pin-input">
        PIN
      </label>
      <input
        id="pin-input"
        className="pin-input mono"
        value={pin}
        maxLength={PIN_SEQUENCE_LENGTH}
        placeholder="123456"
        onChange={(e) => setPin(e.currentTarget.value)}
      />
      <div className="small muted">
        {pin.length}/{PIN_SEQUENCE_LENGTH} · allowed {validation?.allowedKeys.join(' ') ?? '—'}
      </div>
      {validation && !validation.ok ? <p className="fail-row small">{validation.reason}</p> : null}

      <div className="pin-pad">
        {(validation?.allowedKeys ?? ['1', '2', '3', '4', '5', '6']).map((digit) => (
          <button key={digit} onClick={() => addDigit(digit)} disabled={pin.length >= PIN_SEQUENCE_LENGTH}>
            {digit}
          </button>
        ))}
      </div>

      <div className="button-row">
        <button onClick={preflight} disabled={busy || !validation?.ok || !chain}>
          Preflight
        </button>
        <button onClick={execute} disabled={busy || !plan?.allVerified || state !== 'PREFLIGHT_READY'}>
          Execute
        </button>
        <button onClick={resetPin} disabled={busy}>
          Clear
        </button>
      </div>
      <div className="button-row">
        <button onClick={() => coordinatorRef.current?.pause()} disabled={!busy}>
          Pause
        </button>
        <button onClick={() => coordinatorRef.current?.resume()} disabled={!busy}>
          Resume
        </button>
        <button onClick={() => coordinatorRef.current?.cancel()} disabled={!busy}>
          Cancel
        </button>
        <button className="estop-btn" onClick={() => coordinator().emergencyStop()}>
          E-STOP
        </button>
      </div>

      <div className="readout">
        <div className="readout-label">PIN state</div>
        <div className="readout-value mono">
          {state} · digit {activeDigitIndex === null ? '—' : activeDigitIndex + 1} · key {activeKey ?? '—'} ·{' '}
          {stage ?? 'idle'}
        </div>
      </div>
      {plan ? (
        <div className="readout">
          <div className="readout-label">Preflight</div>
          <div className="readout-value mono">
            {plan.allVerified ? 'verified' : 'failed'} · worst {(plan.worstPositionErrorM * 1000).toFixed(2)} mm ·
            tilt {((plan.worstTiltRad * 180) / Math.PI).toFixed(1)} deg
          </div>
        </div>
      ) : null}
      {error ? <p className="fail-row small">{error}</p> : null}

      {report ? (
        <>
          <h3>Evidence</h3>
          <table className="joint-table">
            <thead>
              <tr>
                <th>#</th>
                <th>key</th>
                <th>err mm</th>
                <th>tilt</th>
                <th>status</th>
              </tr>
            </thead>
            <tbody>
              {report.presses.map((press) => (
                <tr key={`${press.runId}-${press.digitIndex}`}>
                  <td>{press.digitIndex + 1}</td>
                  <td>{press.key}</td>
                  <td className="mono">{press.errorMm.toFixed(2)}</td>
                  <td className="mono">{press.stylusTiltDeg.toFixed(1)}°</td>
                  <td>{press.contactSuccess ? 'pass' : 'fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="button-row">
            <button onClick={() => download(`${report.runId}.json`, exportPinReportJson(report), 'application/json')}>
              JSON
            </button>
            <button onClick={() => download(`${report.runId}.csv`, exportPinReportCsv(report), 'text/csv')}>
              CSV
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
