import { useRobotStore } from '../state/robotStore';
import { useRuntimeStore } from '../state/runtimeStore';
import { JoystickPad } from './JoystickPad';
import {
  JOINT_STEP_RADIANS,
  useJointJoystick,
} from './useJointJoystick';
import {
  SPEED_ORDER,
  manualJogGate,
  toDegrees,
  type SpeedMode,
} from './jogModel';

const SPEED_LABEL: Record<SpeedMode, string> = {
  precision: 'Precision',
  normal: 'Normal',
  fast: 'Fast',
};

function formatNumber(value: number): string {
  return Number.isFinite(value)
    ? value.toFixed(4)
    : '—';
}

export function ManualControlPanel() {
  const controls = useJointJoystick();

  const snapshot = useRuntimeStore(
    (state) => state.snapshot,
  );

  const jointMeta = useRobotStore(
    (state) => state.jointMeta,
  );

  const runtimeState =
    snapshot?.state ?? 'BOOTING';

  const activeSource =
    snapshot?.activeCommand?.source ?? null;

  const gate = manualJogGate(
    runtimeState,
    activeSource,
  );

  const disabled =
    gate.status === 'blocked';

  const joint1 = snapshot?.jointValues.joint_1 ?? 0;
  const joint2 = snapshot?.jointValues.joint_2 ?? 0;

  const joint1Meta = jointMeta.find(
    (joint) => joint.name === 'joint_1',
  );

  const joint2Meta = jointMeta.find(
    (joint) => joint.name === 'joint_2',
  );

  return (
    <section
      className="panel"
      aria-label="Joint 1 and joint 2 joystick control"
    >
      <h2>
        Joint joystick
        <span className="temp-badge">
          J1 horizontal · J2 vertical
        </span>
      </h2>

      <p className="muted small">
        This joystick directly controls joint_1 and joint_2
        through validated runtime commands.
      </p>

      {disabled ? (
        <p className="fail-row small">
          {gate.reason}
        </p>
      ) : null}

      <div className="manual-grid joint-only-grid">
        <div className="manual-joystick">
          <JoystickPad
            onVector={controls.setJoystick}
            onRelease={controls.releaseJoystick}
            disabled={disabled}
            size={170}
          />

          <p className="muted small joystick-caption">
            Right/left changes joint_1. Up/down changes
            joint_2. Diagonal input moves both joints
            proportionally.
          </p>
        </div>
      </div>

      <h3>Joint movement speed</h3>

      <div
        className="button-row"
        role="group"
        aria-label="Joint joystick speed"
      >
        {SPEED_ORDER.map((mode) => (
          <button
            key={mode}
            className={
              controls.status.speedMode === mode
                ? 'speed-btn active'
                : 'speed-btn'
            }
            aria-pressed={
              controls.status.speedMode === mode
            }
            onClick={() => controls.setSpeedMode(mode)}
          >
            {SPEED_LABEL[mode]}

            <span className="speed-inc mono">
              {' '}
              {JOINT_STEP_RADIANS[mode].toFixed(3)} rad
            </span>
          </button>
        ))}
      </div>

      <div className="button-row">
        <button onClick={controls.home}>
          Home
        </button>

        <button onClick={controls.stop}>
          Stop
        </button>

        <button
          className="estop-btn"
          onClick={controls.estop}
        >
          E-STOP
        </button>
      </div>

      <h3>Live joint values</h3>

      <div className="readout">
        <div className="readout-label">
          joint_1
        </div>

        <div className="readout-value mono">
          {formatNumber(joint1)} rad ·{' '}
          {toDegrees(joint1).toFixed(2)}°
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">
          joint_2
        </div>

        <div className="readout-value mono">
          {formatNumber(joint2)} rad ·{' '}
          {toDegrees(joint2).toFixed(2)}°
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">
          Joystick vector
        </div>

        <div className="readout-value mono">
          [
          {controls.status.vector[0].toFixed(3)},
          {' '}
          {controls.status.vector[1].toFixed(3)}
          ]
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">
          Last joint change
        </div>

        <div className="readout-value mono">
          J1 {controls.status.joint1Delta.toFixed(5)} rad ·
          J2 {controls.status.joint2Delta.toFixed(5)} rad
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">
          joint_1 limits
        </div>

        <div className="readout-value mono">
          {joint1Meta
            ? `[${joint1Meta.lower.toFixed(3)}, ${joint1Meta.upper.toFixed(3)}]`
            : '—'}
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">
          joint_2 limits
        </div>

        <div className="readout-value mono">
          {joint2Meta
            ? `[${joint2Meta.lower.toFixed(3)}, ${joint2Meta.upper.toFixed(3)}]`
            : '—'}
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">
          Runtime
        </div>

        <div className="readout-value mono">
          {runtimeState}
          {activeSource
            ? ` · owner=${activeSource}`
            : ''}
        </div>
      </div>

      {controls.status.lastRejection ? (
        <p className="fail-row small">
          {controls.status.lastRejection}
        </p>
      ) : null}
    </section>
  );
}