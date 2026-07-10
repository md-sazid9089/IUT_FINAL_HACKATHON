import { LoadingManager, Quaternion, Vector3 } from 'three';
import URDFLoader from 'urdf-loader';
import type { URDFRobot } from 'urdf-loader';

/**
 * RobotModelAdapter is the ONLY module permitted to call urdf-loader joint
 * setters or read the URDF scene graph directly. Input adapters, React
 * components, and (later) the command runtime must go through this boundary.
 *
 * Gate 1 has no command pipeline yet, so the temporary joint-debug panel writes
 * to the Zustand store and this adapter applies those values. That debug path is
 * explicitly documented for removal once the Gate 4/5 pipeline exists.
 */

export const DEFAULT_BASE_LINK = 'base_link';
export const DEFAULT_TCP_LINK = 'stylus_tip';

export interface JointMeta {
  readonly name: string;
  readonly type: URDFRobot['joints'][string]['jointType'];
  readonly axis: readonly [number, number, number];
  readonly lower: number;
  readonly upper: number;
  readonly effort: number;
  readonly velocity: number;
}

export interface RobotModelAdapterOptions {
  readonly baseLink?: string;
  readonly tcpLink?: string;
}

export class RobotModelAdapter {
  private robot: URDFRobot | null = null;
  private readonly baseLink: string;
  private readonly tcpLink: string;
  private readonly scratch = new Vector3();
  private readonly scratchAxis = new Vector3();
  private readonly scratchQuat = new Quaternion();

  constructor(options: RobotModelAdapterOptions = {}) {
    this.baseLink = options.baseLink ?? DEFAULT_BASE_LINK;
    this.tcpLink = options.tcpLink ?? DEFAULT_TCP_LINK;
  }

  get object(): URDFRobot | null {
    return this.robot;
  }

  get baseLinkName(): string {
    return this.baseLink;
  }

  get tcpLinkName(): string {
    return this.tcpLink;
  }

  /** Load and validate a URDF from a URL (browser runtime path). */
  async loadFromUrl(url: string): Promise<URDFRobot> {
    const loader = new URDFLoader(new LoadingManager());
    const robot = await loader.loadAsync(url);
    this.adopt(robot);
    return robot;
  }

  /** Parse and validate a URDF from string content (used by tests). */
  parse(content: string): URDFRobot {
    const loader = new URDFLoader(new LoadingManager());
    const robot = loader.parse(content);
    this.adopt(robot);
    return robot;
  }

  /**
   * Structural validation. A malformed or unexpected URDF throws instead of
   * silently producing a broken twin.
   */
  validateStructure(robot: URDFRobot): void {
    if (!robot || !robot.links || !robot.joints) {
      throw new Error('Parsed object is not a valid URDF robot');
    }
    if (!robot.links[this.baseLink]) {
      throw new Error(`URDF is missing the expected base link "${this.baseLink}"`);
    }
    if (!robot.links[this.tcpLink]) {
      throw new Error(`URDF is missing the expected TCP link "${this.tcpLink}"`);
    }
    if (Object.keys(robot.joints).length === 0) {
      throw new Error('URDF contains no joints');
    }
  }

  getJointMetadata(): JointMeta[] {
    const robot = this.requireRobot();
    return Object.entries(robot.joints).map(([name, joint]) => ({
      name,
      type: joint.jointType,
      axis: [joint.axis.x, joint.axis.y, joint.axis.z] as const,
      lower: Number(joint.limit?.lower ?? 0),
      upper: Number(joint.limit?.upper ?? 0),
      effort: Number(joint.limit?.effort ?? 0),
      velocity: Number(joint.limit?.velocity ?? 0),
    }));
  }

  /** Apply a set of joint values. Unknown joint names are ignored. */
  setJointValues(values: Readonly<Record<string, number>>): void {
    const robot = this.requireRobot();
    for (const [name, value] of Object.entries(values)) {
      if (robot.joints[name]) {
        robot.setJointValue(name, value);
      }
    }
  }

  /** World-space position of the TCP link, read from the rendered scene graph. */
  getTcpWorldPosition(): [number, number, number] {
    const robot = this.requireRobot();
    robot.updateMatrixWorld(true);
    const tcp = robot.links[this.tcpLink];
    if (!tcp) {
      throw new Error(`TCP link "${this.tcpLink}" not found on loaded robot`);
    }
    tcp.getWorldPosition(this.scratch);
    return [this.scratch.x, this.scratch.y, this.scratch.z];
  }

  /**
   * Reference TCP world orientation from the rendered Three.js scene graph.
   * Used only to validate the independent FK engine — never inside it.
   */
  getTcpWorldQuaternion(): [number, number, number, number] {
    const robot = this.requireRobot();
    robot.updateMatrixWorld(true);
    const tcp = robot.links[this.tcpLink];
    if (!tcp) {
      throw new Error(`TCP link "${this.tcpLink}" not found on loaded robot`);
    }
    tcp.getWorldQuaternion(this.scratchQuat);
    return [this.scratchQuat.x, this.scratchQuat.y, this.scratchQuat.z, this.scratchQuat.w];
  }

  /** Reference tool approach axis (tip local +Z in world) from Three.js. */
  getTcpWorldToolAxis(): [number, number, number] {
    const robot = this.requireRobot();
    robot.updateMatrixWorld(true);
    const tcp = robot.links[this.tcpLink];
    if (!tcp) {
      throw new Error(`TCP link "${this.tcpLink}" not found on loaded robot`);
    }
    this.scratchAxis.set(0, 0, 1);
    tcp.getWorldQuaternion(this.scratchQuat);
    this.scratchAxis.applyQuaternion(this.scratchQuat).normalize();
    return [this.scratchAxis.x, this.scratchAxis.y, this.scratchAxis.z];
  }

  private adopt(robot: URDFRobot): void {
    this.validateStructure(robot);
    this.robot = robot;
  }

  private requireRobot(): URDFRobot {
    if (!this.robot) {
      throw new Error('Robot model has not been loaded');
    }
    return this.robot;
  }
}
