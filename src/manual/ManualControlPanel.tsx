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
  const ikStatus =
    state === 'PLANNING' && manualOwns
      ? 'Solving…'
      : state === 'EXECUTING' && manualOwns
        ? 'Executing IK solution'
        : 'Idle';
  const jointValues = snapshot?.jointValues ?? {};

  return (
    <section className="panel" aria-label="3D Cartesian joystick controls">
      <h2>
        3D Cartesian Joystick <span className="temp-badge">TCP → IK → joints</span>
      </h2>
      <p className="muted small">
        You steer the stylus tip in 3D Cartesian space; the DLS IK solver computes all six joint
        angles through the safety pipeline.
      </p>

      {disabled ? <p className="fail-row small">{gate.reason}</p> : null}

      <div className="manual-grid">
        <div className="manual-joystick">
          <JoystickPad
            onVector={controls.setPositionStick}
            onRelease={controls.clearPositionStick}
            disabled={disabled}
            size={108}
          />
          <p className="muted small joystick-caption">
            <strong>1 · Position</strong>
            <br />
            right +X · left −X · up +Y · down −Y
          </p>
        </div>

        <div className="manual-joystick">
          <JoystickPad
            onVector={controls.setOrientationStick}
            onRelease={controls.clearOrientationStick}
            disabled={disabled}
            size={108}
          />
          <p className="muted small joystick-caption">
            <strong>2 · Z / Rotation</strong>
            <br />
            up +Z · down −Z · right/left tool rotation
          </p>
        </div>

        <div className="manual-zcol" aria-label="Z axis control">
          <button
            className="z-btn"
            aria-label="Jog +Z (up). Press and hold."
            disabled={disabled}
            onPointerDown={() => controls.pressZ(1)}
            onPointerUp={controls.releaseZ}
            onPointerLeave={controls.releaseZ}
            onPointerCancel={controls.releaseZ}
            onLostPointerCapture={controls.releaseZ}
          >
            +Z
          </button>
          <span className="z-label mono">Z</span>
          <button
            className="z-btn"
            aria-label="Jog −Z (down). Press and hold."
            disabled={disabled}
            onPointerDown={() => controls.pressZ(-1)}
            onPointerUp={controls.releaseZ}
            onPointerLeave={controls.releaseZ}
            onPointerCancel={controls.releaseZ}
            onLostPointerCapture={controls.releaseZ}
          >
            −Z
          </button>
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
        <div className="readout-label">Rotation input</div>
        <div className="readout-value mono">
          {status.rotationInput === 0 ? '—' : `${fmtDelta(status.rotationInput)} (phase 1: display only)`}
        </div>
      </div>
      <div className="readout">
        <div className="readout-label">Current TCP (m)</div>
        <div className="readout-value mono">{tcp ? fmtVec(tcp) : '— awaiting first sample'}</div>
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
      {status.lastRejection ?? snapshot?.lastRejection ? (
        <p className="fail-row small">Last rejection: {status.lastRejection ?? snapshot?.lastRejection}</p>
      ) : null}

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
