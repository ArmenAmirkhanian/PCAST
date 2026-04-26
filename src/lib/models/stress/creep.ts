/**
 * Creep compliance matrix and Riesz transformation matrices.
 *
 * Converted from VBA Sub createCreep() and Sub creepTransform().
 *
 * The rate-type creep workflow:
 *   1. Build creep compliance matrix J[i][j] = J(t_i, tʹ_j)
 *   2. Build differential compliance ΔJ[i][j]
 *   3. Build lower-triangular transformation matrix B  (creepTransform)
 *   4. Build B⁻¹  (creepTransform)
 *   5. Apply B⁻¹ to load histories → pseudo-loads (transformTemp)
 *   6. Run elastic analysis with pseudo-loads
 *   7. Apply B to elastic stresses → creep-adjusted stresses (creepResults)
 */

import type { CreepModelParams } from './types';

// ---------------------------------------------------------------------------
// Default creep model parameters (placeholder, from VBA)
// ---------------------------------------------------------------------------

export const DEFAULT_CREEP_PARAMS: Required<CreepModelParams> = {
  a1: 1,
  a2Scale: 15,
  a2Rate: 0.0072,
};

// ---------------------------------------------------------------------------
// Creep compliance  J(t, tʹ)
// ---------------------------------------------------------------------------

/**
 * Placeholder effective modulus used only for the creep compliance matrix.
 * E_eff(tʹ) = −12.135 + 7.9557·ln(tʹ)   (GPa-scale, from VBA)
 */
function creepEffectiveModulus(tp: number): number {
  return -12.135 + 7.9557 * Math.log(tp);
}

/**
 * Build the creep compliance matrix J (n × n, lower-triangular filled).
 *
 * J[i][j] = compliance at observation hour t_i due to load applied at tʹ_j,
 *            where t_i = startHour + i, tʹ_j = startHour + j, and i ≥ j.
 *
 * Units: consistent with the VBA (divided by 1000 at the end).
 *
 * @param startHour  First hour index (n0 in VBA)
 * @param nt         Number of time steps
 * @param params     Creep model parameters
 */
export function buildCreepCompliance(
  startHour: number,
  nt: number,
  params: Required<CreepModelParams>,
): number[][] {
  const { a1, a2Scale, a2Rate } = params;
  const J: number[][] = Array.from({ length: nt }, () => new Array<number>(nt).fill(0));

  for (let i = 0; i < nt; i++) {
    const tp = startHour + i;                          // loading age (h)
    const Ep = creepEffectiveModulus(tp);
    const a2 = a2Scale * Math.exp(tp * a2Rate);

    for (let j = i; j < nt; j++) {
      const t = startHour + j;                         // observation time (h)
      const creep =
        (1 / 145 / Ep) * 1e6 * (1 + a1 * (1 - Math.exp(-(t - tp) / a2)));
      J[j][i] = creep / 1000;
    }
  }

  return J;
}

// ---------------------------------------------------------------------------
// Differential compliance  ΔJ
// ---------------------------------------------------------------------------

/**
 * Build the differential creep compliance matrix from J.
 *
 * ΔJ[i][i] = J[i][i]                       (diagonal – elastic)
 * ΔJ[i][j] = J[i][j] − J[i][j+1]  (j < i)  (incremental creep)
 *
 * VBA name: creepInt
 */
export function buildDifferentialCreep(J: number[][]): number[][] {
  const nt = J.length;
  const dJ: number[][] = Array.from({ length: nt }, () => new Array<number>(nt).fill(0));

  for (let i = 0; i < nt; i++) {
    dJ[i][i] = J[i][i];
    for (let j = 0; j < i; j++) {
      dJ[i][j] = J[i][j] - J[i][j + 1];
    }
  }

  return dJ;
}

// ---------------------------------------------------------------------------
// Transformation matrix B  (lower triangular)
// ---------------------------------------------------------------------------

/**
 * Build the Riesz transformation matrix B from the differential compliance ΔJ.
 *
 * B[i][i] = 1
 * B[i][j] = (Σ_{k=j}^{i−1} ΔJ[i][k] · B[k][j]) / (ΔJ[j][j] − ΔJ[i][i])
 *            for j < i
 *
 * VBA: BB matrix in Sub creepTransform()
 */
export function buildTransformationMatrix(dJ: number[][]): number[][] {
  const nt = dJ.length;
  const B: number[][] = Array.from({ length: nt }, () => new Array<number>(nt).fill(0));

  for (let i = 0; i < nt; i++) {
    B[i][i] = 1;
    for (let k = 1; k <= i; k++) {
      const j = i - k;                              // j runs from i−1 down to 0
      let sum = 0;
      for (let k2 = j; k2 < i; k2++) {
        sum += dJ[i][k2] * B[k2][j];
      }
      const denom = dJ[j][j] - dJ[i][i];
      B[i][j] = Math.abs(denom) > 1e-30 ? sum / denom : 0;
    }
  }

  return B;
}

// ---------------------------------------------------------------------------
// Inverse transformation matrix B⁻¹
// ---------------------------------------------------------------------------

/**
 * Build B⁻¹ from B using back-substitution.
 *
 * B⁻¹[i][i] = 1 / B[i][i]  = 1
 * B⁻¹[i][j] = −(Σ_{k=0}^{i−1} B[i][k] · B⁻¹[k][j]) / B[i][i]   for j < i
 *
 * VBA: BBinv matrix in Sub creepTransform()
 */
export function buildInverseTransformation(B: number[][]): number[][] {
  const nt = B.length;
  const Binv: number[][] = Array.from({ length: nt }, () => new Array<number>(nt).fill(0));

  for (let i = 0; i < nt; i++) {
    Binv[i][i] = 1 / B[i][i];           // B[i][i] = 1, so this is always 1
    for (let j = 0; j < i; j++) {
      let sum = 0;
      for (let k = 0; k < i; k++) {
        sum += B[i][k] * Binv[k][j];
      }
      Binv[i][j] = -sum / B[i][i];
    }
  }

  return Binv;
}
