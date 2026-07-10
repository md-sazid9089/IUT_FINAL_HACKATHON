import { describe, expect, it } from 'vitest';
import { DisabledHardwareTransport, HARDWARE_PROTOCOL_VERSION } from './hardwareTransport';

describe('DisabledHardwareTransport', () => {
  it('starts disabled and does not accept hardware commands', async () => {
    const transport = new DisabledHardwareTransport();

    expect(transport.status()).toMatchObject({
      mode: 'hardware-disabled',
      state: 'disabled',
      protocolVersion: HARDWARE_PROTOCOL_VERSION,
      calibrationStatus: 'not-required',
    });

    const connected = await transport.connect();
    expect(connected.state).toBe('disabled');
    expect(connected.communicationFault).toContain('disabled');

    const ack = await transport.send({
      type: 'joint_target',
      messageId: 'msg-1',
      sequence: 1,
      source: 'runtime',
      protocolVersion: HARDWARE_PROTOCOL_VERSION,
      jointRadians: { joint_1: 0 },
      durationMs: 100,
    });
    expect(ack.ok).toBe(false);
    expect(ack.reason).toContain('disabled');
  });
});
