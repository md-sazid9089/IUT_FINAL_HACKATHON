import type { VoiceCommand } from './voiceCommandSchema';

/**
 * Map validated voice commands onto the EXISTING runtime command model. This is
 * pure translation — no robot access, no IK, no safety decisions. The output is
 * submitted to the RuntimeController, which enforces every safety rule exactly
 * as it does for the joystick, keyboard, and PIN sources.
 */

export type RuntimeSubmission =
  | { kind: 'runtime'; command: Record<string, unknown>; description: string }
  | { kind: 'pin'; pin: string; description: string }
  | { kind: 'clarify'; message: string }
  | { kind: 'rejected'; reason: string };

/** Sensible default Cartesian step when the user gives no distance. */
const DEFAULT_STEP_M = 0.03;
/** Hard sanity cap for one spoken move (runtime safety still applies after). */
const MAX_STEP_M = 0.5;
/** Hard sanity cap for one spoken joint rotation (rad). */
const MAX_JOINT_STEP_RAD = Math.PI;

function toMeters(value: number, unit: string | undefined): number {
  switch (unit) {
    case 'centimeter':
      return value / 100;
    case 'millimeter':
      return value / 1000;
    default:
      return value; // meter
  }
}

export interface MapperContext {
  /** Current commanded joint values (for relative joint rotations). */
  readonly jointValues: Readonly<Record<string, number>>;
  /** Current TCP approach axis so Cartesian moves preserve orientation. */
  readonly approachAxis: readonly [number, number, number];
}

export function mapVoiceCommand(cmd: VoiceCommand, ctx: MapperContext): RuntimeSubmission {
  switch (cmd.type) {
    case 'clarification_required':
      return { kind: 'clarify', message: cmd.message };

    case 'stop':
      return {
        kind: 'runtime',
        command: { type: 'stop', source: 'voice' },
        description: 'Stop all motion',
      };

    case 'home':
      return {
        kind: 'runtime',
        command: { type: 'home', source: 'voice' },
        description: 'Move to home position',
      };

    case 'cartesian_move': {
      const magnitude = Math.min(toMeters(cmd.value ?? DEFAULT_STEP_M, cmd.unit), MAX_STEP_M);
      if (!(magnitude > 0)) return { kind: 'rejected', reason: 'Distance must be positive' };
      const sign = cmd.direction === 'negative' ? -1 : 1;
      const delta: [number, number, number] = [0, 0, 0];
      delta[{ x: 0, y: 1, z: 2 }[cmd.axis]] = sign * magnitude;
      return {
        kind: 'runtime',
        command: {
          type: 'cartesian_jog',
          source: 'voice',
          delta,
          approachAxis: [...ctx.approachAxis],
        },
        description: `Move TCP ${cmd.axis.toUpperCase()} ${sign > 0 ? '+' : '−'}${magnitude.toFixed(3)} m`,
      };
    }

    case 'joint_move': {
      const rad = cmd.unit === 'radian' ? cmd.angle : (cmd.angle * Math.PI) / 180;
      if (!Number.isFinite(rad) || rad === 0) {
        return { kind: 'rejected', reason: 'Joint rotation must be a non-zero angle' };
      }
      if (Math.abs(rad) > MAX_JOINT_STEP_RAD) {
        return { kind: 'rejected', reason: 'Joint rotation exceeds the per-command limit (180°)' };
      }
      const current = ctx.jointValues[cmd.joint] ?? 0;
      return {
        kind: 'runtime',
        command: {
          type: 'move_joints',
          source: 'voice',
          joints: { [cmd.joint]: current + rad },
        },
        description: `Rotate ${cmd.joint} by ${((rad * 180) / Math.PI).toFixed(1)}°`,
      };
    }

    case 'pin_execute':
      // PIN automation keeps its explicit Preflight → Execute gate. Voice fills
      // the PIN; the operator confirms execution in the PIN panel.
      return {
        kind: 'pin',
        pin: cmd.pin,
        description: `Enter PIN ${cmd.pin} (confirm Preflight & Execute in the PIN panel)`,
      };
  }
}
