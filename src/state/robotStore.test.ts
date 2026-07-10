import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRobotStore } from './robotStore';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';

const validUrdf = readFileSync(resolve(process.cwd(), 'resources/6_dof_arm.urdf'), 'utf-8');

/** Reset the singleton store to its initial values before each test. */
beforeEach(() => {
  useRobotStore.setState({
    status: 'idle',
    error: null,
    jointMeta: [],
    tcp: null,
    targetKey: null,
  });
});

describe('robotStore TCP telemetry', () => {
  it('starts with tcp = null (no fake zero before the model is ready)', () => {
    expect(useRobotStore.getState().tcp).toBeNull();
  });

  it('does not fabricate a TCP when joint metadata is set', () => {
    const adapter = new RobotModelAdapter();
    adapter.parse(validUrdf);
    useRobotStore.getState().setJointMeta(adapter.getJointMetadata());
    // Metadata only seeds joint values; TCP stays null until the scene publishes.
    expect(useRobotStore.getState().tcp).toBeNull();
  });

  it('publishes the zero-pose TCP ~ (0, 0, 1.497) as the first sample', () => {
    const adapter = new RobotModelAdapter();
    const robot = adapter.parse(validUrdf);
    robot.updateMatrixWorld(true);
    const initial = adapter.getTcpWorldPosition();
    useRobotStore.getState().setTcp(initial);

    const tcp = useRobotStore.getState().tcp;
    expect(tcp).not.toBeNull();
    expect(tcp![0]).toBeCloseTo(0, 3);
    expect(tcp![1]).toBeCloseTo(0, 3);
    expect(tcp![2]).toBeCloseTo(1.497, 3);
  });

  it('changes the published TCP when joint_2 moves', () => {
    const adapter = new RobotModelAdapter();
    const robot = adapter.parse(validUrdf);
    robot.updateMatrixWorld(true);
    const zeroPose = adapter.getTcpWorldPosition();
    useRobotStore.getState().setTcp(zeroPose);

    adapter.setJointValues({ joint_2: 0.6 });
    const moved = adapter.getTcpWorldPosition();
    useRobotStore.getState().setTcp(moved);

    const tcp = useRobotStore.getState().tcp!;
    // Shoulder pitch about Y moves the tip in X and Z away from the zero pose.
    const delta = Math.hypot(tcp[0] - zeroPose[0], tcp[1] - zeroPose[1], tcp[2] - zeroPose[2]);
    expect(delta).toBeGreaterThan(0.05);
  });

  it('changes the published TCP when joint_3 moves', () => {
    const adapter = new RobotModelAdapter();
    const robot = adapter.parse(validUrdf);
    robot.updateMatrixWorld(true);
    const zeroPose = adapter.getTcpWorldPosition();

    adapter.setJointValues({ joint_3: 0.5 });
    const moved = adapter.getTcpWorldPosition();

    const delta = Math.hypot(
      moved[0] - zeroPose[0],
      moved[1] - zeroPose[1],
      moved[2] - zeroPose[2],
    );
    expect(delta).toBeGreaterThan(0.05);
  });
});
