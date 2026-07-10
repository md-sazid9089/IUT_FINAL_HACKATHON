import type { KinematicChain } from './chainTypes';
import { isMovable } from './chainTypes';
import type { JointValues } from './forwardKinematics';
import { mulberry32, sampleRange } from './rng';

export interface NamedConfig {
  readonly label: string;
  readonly values: JointValues;
}

/** Movable joints of a chain, in base→tip order. */
export function movableJoints(chain: KinematicChain) {
  return chain.joints.filter((j) => isMovable(j.type));
}

function zeros(chain: KinematicChain): Record<string, number> {
  const v: Record<string, number> = {};
  for (const j of movableJoints(chain)) v[j.name] = 0;
  return v;
}

/**
 * Deterministic named fixtures required by the gate:
 * zero, midpoint, each lower limit, each upper limit, mixed signs, near
 * extended, wrist-downward. Each config is legal (within joint limits).
 */
export function deterministicFixtures(chain: KinematicChain): NamedConfig[] {
  const movable = movableJoints(chain);
  const fixtures: NamedConfig[] = [];

  // zero
  fixtures.push({ label: 'zero', values: zeros(chain) });

  // midpoint of each joint's limits
  const mid = zeros(chain);
  for (const j of movable) {
    if (j.limit) mid[j.name] = (j.limit.lower + j.limit.upper) / 2;
  }
  fixtures.push({ label: 'midpoint', values: mid });

  // each individual joint at its lower / upper limit (others zero)
  for (const j of movable) {
    if (!j.limit) continue;
    const lower = zeros(chain);
    lower[j.name] = j.limit.lower;
    fixtures.push({ label: `lower:${j.name}`, values: lower });

    const upper = zeros(chain);
    upper[j.name] = j.limit.upper;
    fixtures.push({ label: `upper:${j.name}`, values: upper });
  }

  // mixed signs: alternate a fraction of each limit
  const mixed = zeros(chain);
  movable.forEach((j, i) => {
    if (!j.limit) return;
    const bound = i % 2 === 0 ? j.limit.upper : j.limit.lower;
    mixed[j.name] = bound * 0.5;
  });
  fixtures.push({ label: 'mixed-signs', values: mixed });

  // near extended: small bends keep the arm nearly straight/reaching
  const extended = zeros(chain);
  for (const j of movable) {
    if (j.limit) extended[j.name] = j.limit.upper * 0.05;
  }
  fixtures.push({ label: 'near-extended', values: extended });

  // wrist-downward: fold shoulder + elbow so the tool points broadly downward
  const down = zeros(chain);
  const set = (name: string, value: number) => {
    const j = movable.find((m) => m.name === name);
    if (j?.limit) {
      down[name] = Math.min(j.limit.upper, Math.max(j.limit.lower, value));
    }
  };
  set('joint_2', 1.2);
  set('joint_3', 1.6);
  set('joint_5', 0.9);
  fixtures.push({ label: 'wrist-downward', values: down });

  return fixtures;
}

/**
 * Profile-flavoured fixtures. In the six-joint profile `stylus_pitch` is locked
 * (held at a fixed value); in the seven-joint profile it is active.
 */
export function profileFixtures(chain: KinematicChain): NamedConfig[] {
  const base = zeros(chain);
  const sixJoint: Record<string, number> = { ...base };
  for (let i = 1; i <= 6; i++) sixJoint[`joint_${i}`] = 0.2 * (i % 3 === 0 ? -1 : 1);
  if ('stylus_pitch' in sixJoint) sixJoint['stylus_pitch'] = 0; // locked

  const sevenJoint: Record<string, number> = { ...sixJoint };
  if ('stylus_pitch' in sevenJoint) sevenJoint['stylus_pitch'] = 0.4; // active

  return [
    { label: 'six-joint-profile (stylus_pitch locked=0)', values: sixJoint },
    { label: 'seven-joint-profile (stylus_pitch active)', values: sevenJoint },
  ];
}

/** 100 seeded, reproducible legal configurations sampled within joint limits. */
export function seededConfigs(chain: KinematicChain, count = 100, seed = 0xc0ffee): NamedConfig[] {
  const rand = mulberry32(seed);
  const movable = movableJoints(chain);
  const out: NamedConfig[] = [];
  for (let i = 0; i < count; i++) {
    const values: Record<string, number> = {};
    for (const j of movable) {
      if (j.limit) {
        values[j.name] = sampleRange(rand, j.limit.lower, j.limit.upper);
      } else {
        values[j.name] = 0;
      }
    }
    out.push({ label: `seeded#${i}`, values });
  }
  return out;
}
