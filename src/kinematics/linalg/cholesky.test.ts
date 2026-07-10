import { describe, expect, it } from 'vitest';
import { choleskyFactor, choleskySolve } from './cholesky';

describe('cholesky', () => {
  it('factors an SPD matrix and solves A x = b', () => {
    // A = [[4,12,-16],[12,37,-43],[-16,-43,98]] (classic SPD example).
    const A = new Float64Array([4, 12, -16, 12, 37, -43, -16, -43, 98]);
    const n = 3;
    const L = new Float64Array(9);
    expect(choleskyFactor(A, n, L)).toBe(true);

    // Known Cholesky lower factor.
    expect(L[0]).toBeCloseTo(2, 12);
    expect(L[3]).toBeCloseTo(6, 12);
    expect(L[4]).toBeCloseTo(1, 12);

    // Solve A x = b for a chosen x.
    const xTrue = new Float64Array([1, -2, 0.5]);
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += A[i * n + j]! * xTrue[j]!;
      b[i] = s;
    }
    const x = new Float64Array(n);
    const scratch = new Float64Array(n);
    choleskySolve(L, n, b, x, scratch);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(-2, 10);
    expect(x[2]).toBeCloseTo(0.5, 10);
  });

  it('rejects a non-positive-definite matrix', () => {
    const A = new Float64Array([0, 0, 0, 0]); // 2x2 zero → not PD
    const L = new Float64Array(4);
    expect(choleskyFactor(A, 2, L)).toBe(false);
  });
});
