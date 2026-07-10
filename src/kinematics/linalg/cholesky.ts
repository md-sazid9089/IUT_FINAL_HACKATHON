/**
 * Cholesky factorization and solve for small symmetric positive-definite (SPD)
 * systems. Used to solve (J Jᵀ + λ²I) y = e without ever forming a general
 * matrix inverse.
 *
 * Matrices are row-major `Float64Array` of length n·n; vectors are `Float64Array`
 * of length n. Callers own (and preallocate) all buffers.
 */

/**
 * Factor SPD matrix `A` (n×n, row-major) into a lower-triangular `L` (n×n,
 * row-major) such that A = L·Lᵀ. Returns false if `A` is not positive definite
 * (non-positive pivot), leaving `L` partially written.
 */
export function choleskyFactor(A: Float64Array, n: number, L: Float64Array): boolean {
  L.fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j]!;
      for (let k = 0; k < j; k++) {
        sum -= L[i * n + k]! * L[j * n + k]!;
      }
      if (i === j) {
        if (sum <= 0 || !Number.isFinite(sum)) {
          return false;
        }
        L[i * n + j] = Math.sqrt(sum);
      } else {
        L[i * n + j] = sum / L[j * n + j]!;
      }
    }
  }
  return true;
}

/**
 * Solve A·x = b given the Cholesky factor `L` (A = L·Lᵀ). Forward solve L·z = b,
 * then back solve Lᵀ·x = z. `x` may alias neither `b` nor `L`.
 */
export function choleskySolve(
  L: Float64Array,
  n: number,
  b: Float64Array,
  x: Float64Array,
  scratch: Float64Array,
): void {
  // Forward: L z = b
  for (let i = 0; i < n; i++) {
    let sum = b[i]!;
    for (let k = 0; k < i; k++) {
      sum -= L[i * n + k]! * scratch[k]!;
    }
    scratch[i] = sum / L[i * n + i]!;
  }
  // Backward: Lᵀ x = z
  for (let i = n - 1; i >= 0; i--) {
    let sum = scratch[i]!;
    for (let k = i + 1; k < n; k++) {
      sum -= L[k * n + i]! * x[k]!;
    }
    x[i] = sum / L[i * n + i]!;
  }
}
