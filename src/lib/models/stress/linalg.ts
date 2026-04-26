/**
 * Linear algebra utilities for the stress & creep module.
 * All operations are for 2×2 matrices or lower-triangular n×n matrices.
 */

// ---------------------------------------------------------------------------
// 2×2 operations (used for joint-plate compatibility system)
// ---------------------------------------------------------------------------

/** Multiply a 2×2 matrix by a 2-vector: result = M · v */
export function matVec2(M: number[][], v: number[]): number[] {
  return [
    M[0][0] * v[0] + M[0][1] * v[1],
    M[1][0] * v[0] + M[1][1] * v[1],
  ];
}

/**
 * Invert a 2×2 matrix.
 * Returns a zero matrix (and logs a warning) when the determinant is ~0.
 */
export function inverse2x2(M: number[][]): number[][] {
  const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  if (Math.abs(det) < 1e-30) {
    return [
      [0, 0],
      [0, 0],
    ];
  }
  return [
    [ M[1][1] / det, -M[0][1] / det],
    [-M[1][0] / det,  M[0][0] / det],
  ];
}

/**
 * Solve the 2×2 linear system A·x = b via Cramer's rule.
 * Returns [solution, success]. success is false when A is singular.
 */
export function solve2x2(A: number[][], b: number[]): [number[], boolean] {
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (Math.abs(det) < 1e-30) {
    return [[0, 0], false];
  }
  return [
    [
      (b[0] * A[1][1] - b[1] * A[0][1]) / det,
      (A[0][0] * b[1] - A[1][0] * b[0]) / det,
    ],
    true,
  ];
}

// ---------------------------------------------------------------------------
// Lower-triangular n×n operations (used for creep transformation matrices)
// ---------------------------------------------------------------------------

/**
 * Multiply a lower-triangular n×n matrix B by vector v.
 * result[i] = Σ_{j=0}^{i} B[i][j] · v[j]
 */
export function lowerTriMatVec(B: number[][], v: number[]): number[] {
  const n = v.length;
  const result = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      result[i] += B[i][j] * v[j];
    }
  }
  return result;
}
