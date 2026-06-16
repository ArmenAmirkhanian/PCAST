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

import type { CreepModelParams, CebFipCement } from './types';

// ---------------------------------------------------------------------------
// Default creep model parameters
// ---------------------------------------------------------------------------

export const DEFAULT_CREEP_PARAMS: Required<CreepModelParams> = {
  a1: 1,
  a2Scale: 15,
  a2Rate: 0.0072,
  creepModel: 'hydration',
  agingCoefficient: 0.8,   // χ for AEMM (Trost/Bažant); only used when creepModel = 'aemm'
  cebFipS: 0.25,           // CEB-FIP/EC2 normal-hardening cement
};

/** CEB-FIP MC90 / Eurocode 2 cement-type coefficient s (β_cc strength gain). */
export const CEB_FIP_S: Record<CebFipCement, number> = {
  rapid: 0.20,   // rapid-hardening high-strength (RS): CEM 42.5R, 52.5N/R
  normal: 0.25,  // normal / rapid-hardening (N, R):     CEM 32.5R, 42.5N
  slow: 0.38,    // slow-hardening (SL):                 CEM 32.5N
};

// ---------------------------------------------------------------------------
// Aging elastic modulus  E(tʹ)
// ---------------------------------------------------------------------------

/**
 * CEB-FIP MC90 / Eurocode 2 aging modulus, normalised by E₂₈.
 *
 *   β_cc(tʹ) = exp{ s·[1 − √(28/tʹ_days)] },   E(tʹ)/E₂₈ = √β_cc(tʹ)   (MC90)
 *
 * Strictly positive for every tʹ > 0 and bounded above by E₂₈ (→ 0 only as
 * tʹ → 0). E₂₈ is omitted because the compliance transform is invariant to a
 * global scaling of J (see buildCreepCompliance), so only the relative shape of
 * E(tʹ) across loading ages affects the result.
 */
function cebFipModulusNorm(tHours: number, s: number): number {
  const tDays = Math.max(tHours, 1e-6) / 24;
  const betaCc = Math.exp(s * (1 - Math.sqrt(28 / tDays)));
  return Math.sqrt(betaCc);
}

/**
 * Resolve the per-index aging modulus E(tʹ) profile for the chosen creep model.
 *
 * The 'hydration' and 'aemm' models reuse the beam analysis' own per-hour
 * stiffness (so the compliance and the elastic solve share one E(t)); the
 * 'cebFip' model derives a closed-form profile from loading age alone.
 *
 * Non-positive entries (e.g. a pre-set hour with E = 0 in the supplied array)
 * are floored to a small fraction of the window's peak modulus. This keeps the
 * compliance finite without materially affecting results: pre-set loading ages
 * carry no stress, so their column contributes nothing to the transformed
 * histories.
 */
function modulusProfile(
  startHour: number,
  nt: number,
  params: Required<CreepModelParams>,
  modulusByIndex?: number[],
): number[] {
  if (params.creepModel === 'cebFip') {
    return Array.from({ length: nt }, (_, i) =>
      cebFipModulusNorm(startHour + i, params.cebFipS),
    );
  }

  // 'hydration' or 'aemm': use the model's own E(t) array.
  if (!modulusByIndex || modulusByIndex.length !== nt) {
    throw new RangeError(
      `creepModel '${params.creepModel}' needs a per-hour modulus array of length ${nt}, ` +
      `got ${modulusByIndex?.length ?? 'none'}`,
    );
  }
  const maxE = modulusByIndex.reduce((m, e) => Math.max(m, e), 0);
  const floor = maxE > 0 ? maxE * 1e-4 : 1;
  return modulusByIndex.map((e) => (e > floor ? e : floor));
}

// ---------------------------------------------------------------------------
// Creep compliance  J(t, tʹ)
// ---------------------------------------------------------------------------

/**
 * Build the creep compliance matrix J (n × n, lower-triangular filled).
 *
 * J[i][j] = compliance at observation hour t_i due to load applied at tʹ_j,
 *            where t_i = startHour + i, tʹ_j = startHour + j, and i ≥ j:
 *
 *   J[i][j] = [1 + χ·φ(t_i, tʹ_j)] / E(tʹ_j),
 *   φ(t, tʹ) = a1·(1 − e^{−(t−tʹ)/a2(tʹ)}),   a2(tʹ) = a2Scale · e^{tʹ · a2Rate}
 *
 * χ = `agingCoefficient` for the 'aemm' model and 1 otherwise. E(tʹ) is the
 * bounded aging modulus selected by `creepModel` (see modulusProfile).
 *
 * Scale invariance: the downstream transformation matrix B is built entirely
 * from ratios of ΔJ entries, so multiplying every J entry by a constant leaves
 * B (and therefore the creep-adjusted results) unchanged. Only the *relative*
 * variation of E(tʹ) across loading ages and the shape of φ matter — which is
 * why the closed-form 'cebFip' profile can drop E₂₈ and the per-hour 'hydration'
 * profile can be passed in raw psi.
 *
 * @param startHour       First hour index (n0 in VBA)
 * @param nt              Number of time steps
 * @param params          Creep model parameters (resolved, with defaults applied)
 * @param modulusByIndex  Per-index E(tʹ) for the 'hydration'/'aemm' models
 *                        (modulusByIndex[i] is the stiffness at hour startHour+i)
 */
export function buildCreepCompliance(
  startHour: number,
  nt: number,
  params: Required<CreepModelParams>,
  modulusByIndex?: number[],
): number[][] {
  const { a1, a2Scale, a2Rate, creepModel, agingCoefficient } = params;
  const E = modulusProfile(startHour, nt, params, modulusByIndex);
  const chi = creepModel === 'aemm' ? agingCoefficient : 1;

  const J: number[][] = Array.from({ length: nt }, () => new Array<number>(nt).fill(0));

  for (let i = 0; i < nt; i++) {
    const tp = startHour + i;                          // loading age (h)
    const Ep = E[i];
    const a2 = a2Scale * Math.exp(tp * a2Rate);

    for (let j = i; j < nt; j++) {
      const t = startHour + j;                         // observation time (h)
      const phi = a1 * (1 - Math.exp(-(t - tp) / a2)); // creep coefficient
      J[j][i] = (1 + chi * phi) / Ep;
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
