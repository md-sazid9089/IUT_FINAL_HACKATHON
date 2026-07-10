import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RobotModelAdapter } from './RobotModelAdapter';

const urdfPath = resolve(process.cwd(), 'resources/6_dof_arm.urdf');
const validUrdf = readFileSync(urdfPath, 'utf-8');

describe('RobotModelAdapter — valid URDF', () => {
  it('parses the organizer URDF and discovers all seven revolute joints', () => {
    const adapter = new RobotModelAdapter();
    adapter.parse(validUrdf);
    const meta = adapter.getJointMetadata();
    const revolute = meta
      .filter((m) => m.type === 'revolute')
      .map((m) => m.name)
      .sort();
    expect(revolute).toEqual(
      ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6', 'stylus_pitch'].sort(),
    );
    // The fixed TCP frame joint is also reported, typed as fixed.
    const fixed = meta.find((m) => m.name === 'stylus_tip_frame');
    expect(fixed?.type).toBe('fixed');
  });

  it('reads joint_1 axis and limits from the URDF', () => {
    const adapter = new RobotModelAdapter();
    adapter.parse(validUrdf);
    const j1 = adapter.getJointMetadata().find((m) => m.name === 'joint_1');
    expect(j1?.axis).toEqual([0, 0, 1]);
    expect(j1?.lower).toBeCloseTo(-3.1416, 4);
    expect(j1?.upper).toBeCloseTo(3.1416, 4);
    expect(j1?.velocity).toBeCloseTo(2.5, 4);
  });

  it('exposes the expected base and TCP link names', () => {
    const adapter = new RobotModelAdapter();
    adapter.parse(validUrdf);
    expect(adapter.baseLinkName).toBe('base_link');
    expect(adapter.tcpLinkName).toBe('stylus_tip');
  });

  it('computes a zero-pose TCP near (0, 0, 1.497) from the rendered scene graph', () => {
    const adapter = new RobotModelAdapter();
    adapter.parse(validUrdf);
    const [x, y, z] = adapter.getTcpWorldPosition();
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeCloseTo(0, 3);
    expect(z).toBeCloseTo(1.497, 3);
  });
});

describe('RobotModelAdapter — load/parse failure', () => {
  it('throws when the URDF has no base link', () => {
    const adapter = new RobotModelAdapter();
    expect(() => adapter.parse('<?xml version="1.0"?><robot name="x"></robot>')).toThrow();
  });

  it('throws when the URDF is missing the expected TCP link', () => {
    const adapter = new RobotModelAdapter();
    const noTcp =
      '<?xml version="1.0"?><robot name="x">' +
      '<link name="base_link"/>' +
      '<joint name="j" type="revolute">' +
      '<parent link="base_link"/><child link="link_a"/>' +
      '<axis xyz="0 0 1"/><limit lower="0" upper="1" effort="1" velocity="1"/>' +
      '</joint>' +
      '<link name="link_a"/></robot>';
    expect(() => adapter.parse(noTcp)).toThrow(/TCP link/);
  });

  it('rejects an unreachable URL load', async () => {
    const adapter = new RobotModelAdapter();
    await expect(adapter.loadFromUrl('http://127.0.0.1:0/does-not-exist.urdf')).rejects.toBeTruthy();
  });
});
