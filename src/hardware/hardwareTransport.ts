export const HARDWARE_PROTOCOL_VERSION = 'poc-1';

export type HardwareMode = 'simulation' | 'hardware-disabled' | 'hardware-websocket';
export type HardwareConnectionState = 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'fault';

export interface HardwareTelemetry {
  readonly sequence: number;
  readonly jointRadians: Record<string, number>;
  readonly eStopLatched: boolean;
  readonly fault: string | null;
}

export interface HardwareAck {
  readonly messageId: string;
  readonly ok: boolean;
  readonly reason?: string;
}

export interface HardwareStatus {
  readonly mode: HardwareMode;
  readonly state: HardwareConnectionState;
  readonly protocolVersion: string;
  readonly deviceId: string | null;
  readonly heartbeatOk: boolean;
  readonly lastAck: HardwareAck | null;
  readonly lastTelemetry: HardwareTelemetry | null;
  readonly hardwareEStop: boolean;
  readonly communicationFault: string | null;
  readonly calibrationStatus: 'not-required' | 'missing' | 'loaded' | 'mismatch';
}

export interface HardwareCommand {
  readonly type:
    | 'hello'
    | 'joint_target'
    | 'trajectory_chunk'
    | 'home'
    | 'stop'
    | 'emergency_stop'
    | 'reset_emergency_stop'
    | 'heartbeat';
  readonly messageId: string;
  readonly sequence: number;
  readonly source: 'runtime';
  readonly protocolVersion: string;
  readonly jointRadians?: Record<string, number>;
  readonly durationMs?: number;
}

export interface HardwareTransport {
  status(): HardwareStatus;
  connect(): Promise<HardwareStatus>;
  disconnect(): Promise<HardwareStatus>;
  send(command: HardwareCommand): Promise<HardwareAck>;
  stop(): Promise<HardwareAck>;
  emergencyStop(): Promise<HardwareAck>;
  resetEmergencyStop(): Promise<HardwareAck>;
}

const disabledStatus: HardwareStatus = {
  mode: 'hardware-disabled',
  state: 'disabled',
  protocolVersion: HARDWARE_PROTOCOL_VERSION,
  deviceId: null,
  heartbeatOk: false,
  lastAck: null,
  lastTelemetry: null,
  hardwareEStop: false,
  communicationFault: null,
  calibrationStatus: 'not-required',
};

export class DisabledHardwareTransport implements HardwareTransport {
  private current = disabledStatus;

  status(): HardwareStatus {
    return this.current;
  }

  async connect(): Promise<HardwareStatus> {
    this.current = {
      ...disabledStatus,
      communicationFault: 'Hardware mode is disabled; simulation remains active.',
    };
    return this.current;
  }

  async disconnect(): Promise<HardwareStatus> {
    this.current = disabledStatus;
    return this.current;
  }

  async send(command: HardwareCommand): Promise<HardwareAck> {
    return this.reject(command.messageId);
  }

  async stop(): Promise<HardwareAck> {
    return this.reject('disabled-stop');
  }

  async emergencyStop(): Promise<HardwareAck> {
    return this.reject('disabled-estop');
  }

  async resetEmergencyStop(): Promise<HardwareAck> {
    return this.reject('disabled-reset');
  }

  private reject(messageId: string): HardwareAck {
    const ack = {
      messageId,
      ok: false,
      reason: 'Hardware transport disabled by default.',
    };
    this.current = { ...this.current, lastAck: ack };
    return ack;
  }
}
