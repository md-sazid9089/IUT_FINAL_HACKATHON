/**
 * Minimal dense small-matrix operations over row-major `Float64Array`.
 * Dimensions are passed explicitly so buffers can be preallocated and reused.
 * These are intended for the tiny (≤ 6×6, ≤ 6×n) systems in the DLS solver.
 */

/** out(m×m) = A(m×n) · A(m×n)ᵀ. */
export function multiplyABt(A: Float64Array, m: number, n: number, out: Float64Array): void {
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[i * n + k]! * A[j * n + k]!;
      }
      out[i * m + j] = sum;
    }
  }
}

/** In place: A(n×n) += s · I. */
export function addScaledIdentity(A: Float64Array, n: number, s: number): void {
  for (let i = 0; i < n; i++) {
    A[i * n + i] = A[i * n + i]! + s;
  }
}

/** out(m) = A(m×n) · x(n). */
export function matVec(A: Float64Array, m: number, n: number, x: Float64Array, out: Float64Array): void {
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += A[i * n + k]! * x[k]!;
    }
    out[i] = sum;
  }
}

/** out(n) = A(m×n)ᵀ · y(m). */
export function transposeMatVec(
  A: Float64Array,
  m: number,
  n: number,
  y: Float64Array,
  out: Float64Array,
): void {
  for (let j = 0; j < n; j++) {
    let sum = 0;
    for (let i = 0; i < m; i++) {
      sum += A[i * n + j]! * y[i]!;
    }
    out[j] = sum;
  }
}

export function vectorNorm(v: Float64Array, len: number): number {
  let sum = 0;
  for (let i = 0; i < len; i++) sum += v[i]! * v[i]!;
  return Math.sqrt(sum);
}
