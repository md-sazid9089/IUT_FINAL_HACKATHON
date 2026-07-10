/**
 * Deterministic seeded PRNG (mulberry32). Same seed → same sequence, so the
 * "100 random legal configurations" test is fully reproducible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform sample in [lower, upper] from a 0..1 generator. */
export function sampleRange(rand: () => number, lower: number, upper: number): number {
  return lower + (upper - lower) * rand();
}
