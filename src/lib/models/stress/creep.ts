/**
 * Creep compliance matrix and the pseudo-load transformation it drives.
 *
 * The rate-type creep workflow (see derivation below):
 *   1. Build creep compliance matrix J[i][j] = J(t_i, tʹ_j)
 *   2. Build the pseudo-load operator B⁻¹ from J (buildPseudoLoadOperator)
 *   3. Apply B⁻¹ to load histories → pseudo-loads (transformTemp)
 *   4. Run elastic analysis with pseudo-loads at each hour's own modulus
 *   5. Apply B (a running sum) to the elastic-stress history →
 *      creep-adjusted stresses (creepResults)
 *
 * Derivation of B and B⁻¹
 * -----------------------
 * A fully-restrained history cancels the free (thermal) strain with an equal
 * and opposite mechanical strain, so the mechanical strain at hour i satisfies
 * the discrete Volterra relation for a piecewise-constant stress history:
 *
 *   ε_i = Σ_{j≤i} J[i][j]·Δσ_j                                          (1)
 *
 * where Δσ_j is the stress *increment* applied at hour j. Because J[i][i] =
 * 1/E(tʹ_i) (no creep term at t = tʹ), writing Δσ_j = E(tʹ_j)·p_j — i.e. the
 * increment is exactly the elastic response of some "pseudo-strain" p_j at
 * hour j's own modulus, which is what the beam analysis already computes each
 * hour — turns (1) into a unit lower-triangular system for p:
 *
 *   ε = M·p,   M[i][j] = J[i][j]·E(tʹ_j) for j<i, M[i][i] = 1   ⟺   p = M⁻¹·ε = B⁻¹·ε   (2)
 *
 * solved once via ordinary forward substitution (buildPseudoLoadOperator).
 * Because Δσ_j = E(tʹ_j)·p_j is itself the elastic-stress history the beam
 * analysis produces, the creep-adjusted *total* stress at hour i is simply
 * the running sum Σ_{j≤i} Δσ_j: B is the unit lower-triangular "cumulative
 * sum" operator (buildCumulativeSumOperator) — independent of the compliance
 * kernel, and never a near-singular pivot away from blowing up.
 *
 * (A prior implementation built B from divided differences of the aging
 * compliance diagonal, one basis function per hour. That interpolates J
 * exactly at every sampled hour but is a Cauchy-matrix-style construction:
 * its conditioning degrades sharply whenever two hours have nearly equal
 * instantaneous compliance — which is the normal case once concrete matures
 * and E(t) flattens out — and explodes the "creep-adjusted" stress by orders
 * of magnitude well before the 72-hour window ends. The forward-substitution
 * form above needs only that E(tʹ) stay positive and bounded, which the aging
 * modulus profile already guarantees.)
 *
 * A consequence worth flagging: M[i][j] = J[i][j]·E(tʹ_j) = 1 + χ·φ(t_i,tʹ_j)
 * exactly (E(tʹ_j) cancels the 1/E(tʹ_j) baked into J by construction), so B⁻¹
 * depends only on the *shape* of φ (a1, a2Scale, a2Rate) and χ — never on the
 * absolute aging-modulus profile used to normalise J. The 'creepModel' choice
 * of E(tʹ) (hydration/cebFip/aemm) therefore cannot change B⁻¹ or the
 * creep-adjusted stress on its own; only a genuine change to φ's shape or to χ
 * (the 'aemm' aging coefficient) does. This is a property of the pseudo-load
 * method itself, not a limitation of this implementation — a *different*
 * closed-form E(tʹ) profile only matters if it also drives the elastic beam
 * solve's own modulus, which 'cebFip' deliberately does not (it stays
 * self-contained, independent of the hydration model's E(t) — see CreepModel
 * in types.ts).
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
 * Scale invariance: the downstream pseudo-load operator B⁻¹ (buildPseudoLoadOperator)
 * is built from J[i][j]·E(tʹ_j), which collapses to exactly 1+χφ(t_i,tʹ_j) —
 * E(tʹ) cancels out entirely, at any scale or shape. Only φ's shape (a1,
 * a2Scale, a2Rate) and χ matter — which is why the closed-form 'cebFip'
 * profile can drop E₂₈ and the per-hour 'hydration' profile can be passed in
 * raw psi: neither choice can change the result on its own (see the
 * module-level derivation above).
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
// Pseudo-load operator  B⁻¹
// ---------------------------------------------------------------------------

/**
 * Build the pseudo-load operator B⁻¹ (see the module-level derivation).
 *
 * B⁻¹ is the inverse of the unit lower-triangular matrix
 * M[i][j] = J[i][j]·E(tʹ_j) for j < i, M[i][i] = 1, obtained by the standard
 * (and numerically stable — M's diagonal is exactly 1, never a small pivot)
 * forward-substitution formula for inverting a unit lower-triangular matrix:
 *
 *   B⁻¹[i][i] = 1
 *   B⁻¹[i][j] = −Σ_{k=j}^{i−1} J[i][k]·E(tʹ_k)·B⁻¹[k][j]     for j < i
 *
 * `E` must be the same per-index aging modulus used to build `J` (the
 * loading-age modulus profile, resolved by `modulusProfile` — the caller
 * passes the same `params`/`modulusByIndex` used for `buildCreepCompliance`
 * so the two stay consistent for every creep model, including the
 * self-contained 'cebFip' profile).
 */
export function buildPseudoLoadOperator(
  J: number[][],
  startHour: number,
  nt: number,
  params: Required<CreepModelParams>,
  modulusByIndex?: number[],
): number[][] {
  const E = modulusProfile(startHour, nt, params, modulusByIndex);
  const Binv: number[][] = Array.from({ length: nt }, () => new Array<number>(nt).fill(0));

  for (let i = 0; i < nt; i++) {
    Binv[i][i] = 1;
    for (let j = 0; j < i; j++) {
      let sum = 0;
      for (let k = j; k < i; k++) {
        sum += J[i][k] * E[k] * Binv[k][j];
      }
      Binv[i][j] = -sum;
    }
  }

  return Binv;
}

// ---------------------------------------------------------------------------
// Creep-adjustment operator  B  (cumulative sum)
// ---------------------------------------------------------------------------

/**
 * Build the creep-adjustment operator B applied to the elastic-stress history
 * to recover the creep-adjusted (relaxed) stress — see the module-level
 * derivation. Because the elastic-stress history IS the stress-increment
 * history Δσ, B is simply the unit lower-triangular running-sum operator,
 * independent of the compliance kernel or the aging modulus.
 */
export function buildCumulativeSumOperator(nt: number): number[][] {
  return Array.from({ length: nt }, (_, i) =>
    Array.from({ length: nt }, (_, j) => (j <= i ? 1 : 0)),
  );
}
