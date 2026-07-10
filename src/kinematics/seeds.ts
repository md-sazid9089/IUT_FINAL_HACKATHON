import type { KinematicChain } from './chainTypes';
import { mulberry32, sampleRange } from './rng';

export interface JointBound {
  readonly name: string;
  readonly lower: number;
  readonly upper: number;
}

/** Resolve limits for the active joints from the chain (fallback ±π). */
export function activeJointBounds(
  chain: KinematicChain,
  activeJoints: readonly string[],
): JointBound[] {
  return activeJoints.map((name) => {
    const joint = chain.joints.find((j) => j.name === name);
    const lower = joint?.limit?.lower ?? -Math.PI;
    const upper = joint?.limit?.upper ?? Math.PI;
    return { name, lower, upper };
  });
}

function clampToBounds(values: number[], bounds: JointBound[]): number[] {
  return values.map((v, i) => Math.min(bounds[i]!.upper, Math.max(bounds[i]!.lower, v)));
}

/**
 * Deterministic seed strategy: primary seed (or zeros), midrange, a structured
 * grid over the given reorientation joints (which swing the tool through the
 * vertical plane), and a fixed set of reproducible pseudo-random legal configs.
 * Same inputs → same seeds, so solves are fully repeatable. Seeds are starting
 * guesses only — never hardcoded solutions.
 */
export function buildSeeds(
  bounds: JointBound[],
  primary: Readonly<Record<string, number>> | undefined,
  alternateCount = 12,
  gridJoints: readonly string[] = [],
  seed = 0x5eed,
): number[][] {
  const seeds: number[][] = [];

  // Primary: provided seed clamped, else zeros clamped into range.
  const primaryVec = bounds.map((b) => {
    const v = primary?.[b.name];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });
  seeds.push(clampToBounds(primaryVec, bounds));

  // Midrange.
  seeds.push(bounds.map((b) => (b.lower + b.upper) / 2));

  // Structured grid over up to three reorientation joints.
  const gridIdx = gridJoints
    .map((name) => bounds.findIndex((b) => b.name === name))
    .filter((i) => i >= 0)
    .slice(0, 3);
  if (gridIdx.length > 0) {
    const levelsFor = (b: JointBound): number[] => [b.lower * 0.6, 0, b.upper * 0.6];
    const combos = cartesian(gridIdx.map((i) => levelsFor(bounds[i]!)));
    for (const combo of combos) {
      const vec = bounds.map(() => 0);
      gridIdx.forEach((idx, k) => (vec[idx] = combo[k]!));
      seeds.push(clampToBounds(vec, bounds));
    }
  }

  // Reproducible pseudo-random legal configs.
  const rand = mulberry32(seed);
  for (let i = 0; i < alternateCount; i++) {
    seeds.push(bounds.map((b) => sampleRange(rand, b.lower, b.upper)));
  }

  return seeds;
}

function cartesian(levels: number[][]): number[][] {
  return levels.reduce<number[][]>(
    (acc, dim) => acc.flatMap((prefix) => dim.map((v) => [...prefix, v])),
    [[]],
  );
}
