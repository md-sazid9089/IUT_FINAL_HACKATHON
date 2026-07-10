import { useRuntimeStore } from '../state/runtimeStore';
import { useRobotStore } from '../state/robotStore';
import { JoystickPad } from './JoystickPad';
import { useCartesianJoystick } from './useCartesianJoystick';
import { SPEED_INCREMENTS, SPEED_ORDER, manualJogGate, toDegrees, type SpeedMode } from './jogModel';
import { isManualSource } from '../runtime/commands';

const SPEED_LABEL: Record<SpeedMode, string> = {
  precision: 'Precision',
  normal: 'Normal',
  fast: 'Fast',
};

const ARM_JOINTS = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'] as const;

function fmtVec(v: readonly number[]): string {
  return `[${v.map((n) => n.toFixed(3)).join(', ')}]`;
}

function fmtDelta(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(4)}`;
}

/**
 * Manual Cartesian controls: XY joystick, Z buttons, speed modes, keyboard, and
 * live status. Every input flows through the ManualJogEngine → Gate 4 runtime;
 * nothing here touches joints or the URDF directly.
 */
export function ManualControlPanel() {
  const controls = useCartesianJoystick();
  const snapshot = useRuntimeStore((s) => s.snapshot);
  const tcp = useRobotStore((s) => s.tcp);
  const state = snapshot?.state ?? 'BOOTING';
  const activeSource = snapshot?.activeCommand?.source ?? null;
  const gate = manualJogGate(state, activeSource);
  const disabled = gate.status === 'blocked';
  const { status } = controls;

  // IK pipeline status for the manual Cartesian jog (planning = worker solving).
  const manualOwns = activeSource !== null && isManualSource(activeSource);
  const lastRejection = status.lastRejection ?? snapshot?.lastRejection ?? null;
  const ikUnreachable = lastRejection !== null && lastRejection.includes('IK failed');
  const ikStatus =
    state === 'PLANNING' && manualOwns
      ? 'Solving…'
      : state === 'EXECUTING' && manualOwns
        ? 'Success — executing IK solution'
        : ikUnreachable
          ? 'Failed — target unreachable (robot holds previous pose)'
          : 'Idle';
  const jointValues = snapshot?.jointValues ?? {};
  // Target TCP = current pose + the delta being commanded this step.
  const target = tcp
    ? [tcp[0] + status.movementVector[0], tcp[1] + status.movementVector[1], tcp[2] + status.movementVector[2]]
    : null;

  return (
    <section className="panel" aria-label="Cartesian robot control">
      <h2>
        Cartesian Robot Control <span className="temp-badge">TCP → IK → joints</span>
      </h2>
      <p className="muted small">
        You steer the stylus tip in 3D Cartesian space; the DLS IK solver computes all six joint
        angles through the safety pipeline.
      </p>

      {disabled ? <p className="fail-row small">{gate.reason}</p> : null}

      <div className="manual-grid">
        <div className="manual-joystick">
          <JoystickPad
            axis="x"
            ariaLabel="X-axis joystick. Right +X, left −X."
            onVector={(x) => controls.setAxis('x', x)}
            onRelease={() => controls.clearAxis('x')}
            disabled={disabled}
            size={96}
          />
          <p className="muted small joystick-caption">
            <strong>X</strong>
            <br />
            right + · left −
          </p>
        </div>

        <div className="manual-joystick">
          <JoystickPad
            axis="y"
            ariaLabel="Y-axis joystick. Up +Y, down −Y."
            onVector={(_, y) => controls.setAxis('y', y)}
            onRelease={() => controls.clearAxis('y')}
            disabled={disabled}
            size={96}
          />
          <p className="muted small joystick-caption">
            <strong>Y</strong>
            <br />
            up + · down −
          </p>
        </div>

        <div className="manual-joystick">
          <JoystickPad
            axis="y"
            ariaLabel="Z-axis joystick. Up +Z, down −Z."
            onVector={(_, y) => controls.setAxis('z', y)}
            onRelease={() => controls.clearAxis('z')}
            disabled={disabled}
            size={96}
          />
          <p className="muted small joystick-caption">
            <strong>Z</strong>
            <br />
            up + · down −
          </p>
        </div>
      </div>

      <h3>Speed mode</h3>
      <div className="button-row" role="group" aria-label="Cartesian speed mode">
        {SPEED_ORDER.map((mode) => (
          <button
            key={mode}
            className={status.speedMode === mode ? 'speed-btn active' : 'speed-btn'}
            aria-pressed={status.speedMode === mode}
            onClick={() => controls.setBaseSpeed(mode)}
          >
            {SPEED_LABEL[mode]}
            <span className="speed-inc mono"> {SPEED_INCREMENTS[mode].toFixed(3)} m</span>
          </button>
        ))}
      </div>

      <div className="button-row">
        <button onClick={controls.home}>Home (H)</button>
        <button onClick={controls.stopMotion}>Stop (Space)</button>
        <button className="estop-btn" onClick={controls.estop}>
          E-STOP (Esc)
        </button>
      </div>

      <h3>Status</h3>
      <div className="readout">
        <div className="readout-label">TCP Δ per step (m)</div>
        <div className="readout-value mono">
          ΔX {fmtDelta(status.movementVector[0])} · ΔY {fmtDelta(status.movementVector[1])} · ΔZ{' '}
          {fmtDelta(status.movementVector[2])}
        </div>
      </div>
      <div className="readout">
        <div className="readout-label">Current TCP (m)</div>
        <div className="readout-value mono">{tcp ? fmtVec(tcp) : '— awaiting first sample'}</div>
      </div>
      <div className="readout">
        <div className="readout-label">Target TCP (m)</div>
        <div className="readout-value mono">{target ? fmtVec(target) : '—'}</div>
      </div>
      <div className="readout">
        <div className="readout-label">IK status</div>
        <div className="readout-value mono">{ikStatus}</div>
      </div>
      <div className="readout">
        <div className="readout-label">IK joint solution (deg)</div>
        <div className="readout-value mono small">
          {ARM_JOINTS.map((j) => `${j.replace('joint_', 'J')} ${toDegrees(jointValues[j] ?? 0).toFixed(1)}°`).join(
            ' · ',
          )}
        </div>
      </div>
      <div className="readout">
        <div className="readout-label">Speed / source</div>
        <div className="readout-value mono">
          {SPEED_LABEL[status.speedMode]} ({SPEED_INCREMENTS[status.speedMode].toFixed(3)} m) ·{' '}
          {status.activeSource ?? 'idle'}
        </div>
      </div>
      <div className="readout">
        <div className="readout-label">Keys held</div>
        <div className="readout-value mono">
          {status.heldKeys.length ? status.heldKeys.map((k) => k.toUpperCase()).join(' ') : '—'}
        </div>
      </div>
      <div className="readout">
        <div className="readout-label">Joystick vector</div>
        <div className="readout-value mono">{fmtVec(status.joystickVector)}</div>
      </div>
      <div className="readout">
        <div className="readout-label">Runtime state</div>
        <div className="readout-value mono">
          {state}
          {activeSource ? ` · owner=${activeSource}` : ''}
        </div>
      </div>
      {lastRejection ? <p className="fail-row small">Last rejection: {lastRejection}</p> : null}

      <h3>Keyboard</h3>
      <ul className="key-help small mono">
        <li>W / S — +Y / −Y</li>
        <li>A / D — −X / +X</li>
        <li>R / F — +Z / −Z</li>
        <li>Shift — fast · Alt — precision</li>
        <li>H — home · Space — stop · Esc — E-stop</li>
      </ul>
      <p className="muted small">Shortcuts are ignored while typing in a text field.</p>
    </section>
  );
}
