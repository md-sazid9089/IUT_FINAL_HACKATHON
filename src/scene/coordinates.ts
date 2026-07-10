import type { ApproachAxis, Vec3Coord } from '../config/keyConfig';

export type Vec3Tuple = [number, number, number];

/** Unit vector for a named approach axis, in the base frame. */
export function approachUnitVector(axis: ApproachAxis): Vec3Tuple {
  switch (axis) {
    case 'x':
      return [1, 0, 0];
    case '-x':
      return [-1, 0, 0];
    case 'y':
      return [0, 1, 0];
    case '-y':
      return [0, -1, 0];
    case 'z':
      return [0, 0, 1];
    case '-z':
      return [0, 0, -1];
  }
}

export function coordToTuple(c: Vec3Coord): Vec3Tuple {
  return [c.x, c.y, c.z];
}

/**
 * Each configured key coordinate is the *top contact point* (the surface the
 * stylus tip touches). The rendered button body must sit below that surface so
 * the coordinate visually matches the top of the button.
 *
 * The stylus descends along the approach axis (e.g. `-z`), so the button body
 * extends from the contact point in the approach direction. Its geometric
 * centre is therefore offset by half its height along the approach unit vector.
 */
export function keyButtonCenter(
  contact: Vec3Coord,
  approachAxis: ApproachAxis,
  height: number,
): Vec3Tuple {
  const a = approachUnitVector(approachAxis);
  const half = height / 2;
  return [contact.x + a[0] * half, contact.y + a[1] * half, contact.z + a[2] * half];
}
