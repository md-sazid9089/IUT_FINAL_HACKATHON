/**
 * Runtime state machine.
 *
 * BOOTING → MODEL_LOADING → SELF_TEST → READY → PLANNING → EXECUTING
 *           PAUSED, STOPPING, E_STOPPED, FAULT are reachable per the table below.
 */
export type RuntimeState =
  | 'BOOTING'
  | 'MODEL_LOADING'
  | 'SELF_TEST'
  | 'READY'
  | 'PLANNING'
  | 'EXECUTING'
  | 'PAUSED'
  | 'STOPPING'
  | 'E_STOPPED'
  | 'FAULT';

/** States in which the robot may accept a new movement command. */
export const MOVEMENT_READY_STATES: ReadonlySet<RuntimeState> = new Set<RuntimeState>([
  'READY',
  'EXECUTING', // a higher-priority command may preempt
]);

const ALLOWED: Record<RuntimeState, ReadonlySet<RuntimeState>> = {
  BOOTING: new Set(['MODEL_LOADING', 'FAULT', 'E_STOPPED']),
  MODEL_LOADING: new Set(['SELF_TEST', 'FAULT', 'E_STOPPED']),
  SELF_TEST: new Set(['READY', 'FAULT', 'E_STOPPED']),
  READY: new Set(['PLANNING', 'EXECUTING', 'STOPPING', 'E_STOPPED', 'FAULT']),
  PLANNING: new Set(['EXECUTING', 'READY', 'STOPPING', 'E_STOPPED', 'FAULT']),
  EXECUTING: new Set(['READY', 'PAUSED', 'STOPPING', 'PLANNING', 'E_STOPPED', 'FAULT']),
  PAUSED: new Set(['EXECUTING', 'READY', 'STOPPING', 'E_STOPPED', 'FAULT']),
  STOPPING: new Set(['READY', 'E_STOPPED', 'FAULT']),
  // E-stop can only leave via an explicit reset (→ SELF_TEST).
  E_STOPPED: new Set(['SELF_TEST', 'FAULT']),
  FAULT: new Set(['E_STOPPED']),
};

export function canTransition(from: RuntimeState, to: RuntimeState): boolean {
  if (from === to) return true;
  return ALLOWED[from].has(to);
}
