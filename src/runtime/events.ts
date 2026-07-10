import type { CommandSource } from './commands';
import type { RuntimeState } from './runtimeState';

/** Structured runtime event log entries with human-readable messages. */

export type RuntimeEventLevel = 'info' | 'warn' | 'error';

export type RuntimeEventKind =
  | 'command_accepted'
  | 'command_rejected'
  | 'command_preempted'
  | 'planning_started'
  | 'planning_failed'
  | 'trajectory_started'
  | 'trajectory_completed'
  | 'state_changed'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'estop'
  | 'estop_reset'
  | 'fault';

export interface RuntimeEvent {
  readonly seq: number;
  readonly t: number;
  readonly level: RuntimeEventLevel;
  readonly kind: RuntimeEventKind;
  readonly message: string;
  readonly source?: CommandSource;
  readonly state?: RuntimeState;
}

export class EventLog {
  private seq = 0;
  private readonly events: RuntimeEvent[] = [];
  constructor(private readonly max = 200) {}

  add(
    level: RuntimeEventLevel,
    kind: RuntimeEventKind,
    message: string,
    extra: { source?: CommandSource; state?: RuntimeState; t?: number } = {},
  ): RuntimeEvent {
    this.seq += 1;
    const event: RuntimeEvent = {
      seq: this.seq,
      t: extra.t ?? Date.now(),
      level,
      kind,
      message,
      source: extra.source,
      state: extra.state,
    };
    this.events.push(event);
    if (this.events.length > this.max) this.events.shift();
    return event;
  }

  recent(n = 30): RuntimeEvent[] {
    return this.events.slice(-n);
  }
}
