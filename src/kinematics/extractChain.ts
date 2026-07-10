import type { URDFRobot } from 'urdf-loader';
import type { Vec3 } from './spatial';
import type { ChainJoint, JointLimit, JointType, KinematicChain } from './chainTypes';

/**
 * Generic base→tip chain extraction.
 *
 * The chain is read from the URDF XML nodes (`urdfNode`) that urdf-loader
 * attaches to each joint — origin xyz/rpy, axis, limits, parent/child links.
 * This deliberately does NOT read Three.js Object3D transforms, keeping the FK
 * inputs independent of the Three.js math that will later be used as reference.
 */

function parseVec3(value: string | null, fallback: Vec3): Vec3 {
  if (!value) return fallback;
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return fallback;
  return [parts[0]!, parts[1]!, parts[2]!];
}

function parseLimit(el: Element | null): JointLimit | null {
  if (!el) return null;
  const num = (name: string): number => {
    const raw = el.getAttribute(name);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    lower: num('lower'),
    upper: num('upper'),
    effort: num('effort'),
    velocity: num('velocity'),
  };
}

function childElement(node: Element, tag: string): Element | null {
  for (const child of Array.from(node.children)) {
    if (child.tagName.toLowerCase() === tag) return child;
  }
  return null;
}

/**
 * Build a map from child-link name → the joint whose child it is. Each link has
 * at most one parent joint in a tree URDF.
 */
function buildJointByChild(robot: URDFRobot): Map<string, ChainJoint> {
  const byChild = new Map<string, ChainJoint>();
  for (const [name, joint] of Object.entries(robot.joints)) {
    const node = joint.urdfNode;
    if (!node) {
      throw new Error(`Joint "${name}" has no URDF XML node for extraction`);
    }
    const parentEl = childElement(node, 'parent');
    const childEl = childElement(node, 'child');
    const parentLink = parentEl?.getAttribute('link');
    const childLink = childEl?.getAttribute('link');
    if (!parentLink || !childLink) {
      throw new Error(`Joint "${name}" is missing parent/child link references`);
    }
    const originEl = childElement(node, 'origin');
    const axisEl = childElement(node, 'axis');
    const type = (node.getAttribute('type') ?? joint.jointType) as JointType;

    byChild.set(childLink, {
      name,
      type,
      parentLink,
      childLink,
      originXyz: parseVec3(originEl?.getAttribute('xyz') ?? null, [0, 0, 0]),
      originRpy: parseVec3(originEl?.getAttribute('rpy') ?? null, [0, 0, 0]),
      // URDF default axis when unspecified is (1, 0, 0); fixed joints ignore it.
      axis: parseVec3(axisEl?.getAttribute('xyz') ?? null, [1, 0, 0]),
      limit: parseLimit(childElement(node, 'limit')),
    });
  }
  return byChild;
}

/** Extract the ordered base→tip chain between two links. */
export function extractChain(
  robot: URDFRobot,
  baseLink: string,
  tipLink: string,
): KinematicChain {
  if (!robot.links[baseLink]) throw new Error(`Base link "${baseLink}" not found`);
  if (!robot.links[tipLink]) throw new Error(`Tip link "${tipLink}" not found`);

  const byChild = buildJointByChild(robot);
  const reversed: ChainJoint[] = [];
  const visited = new Set<string>();

  let current = tipLink;
  while (current !== baseLink) {
    if (visited.has(current)) {
      throw new Error(`Cycle detected while walking to "${baseLink}" at "${current}"`);
    }
    visited.add(current);
    const joint = byChild.get(current);
    if (!joint) {
      throw new Error(`No parent joint for link "${current}"; cannot reach "${baseLink}"`);
    }
    reversed.push(joint);
    current = joint.parentLink;
  }

  reversed.reverse();
  return { baseLink, tipLink, joints: reversed };
}
