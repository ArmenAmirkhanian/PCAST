/**
 * Joint stiffness and stress-intensity coefficients for a sawcut concrete joint.
 *
 * Converted from VBA Sub joint() in JointModule.
 *
 * The sub originally read tabulated compliance values from a spreadsheet and
 * interpolated quadratically.  Here the compliance integrals are computed
 * directly from the closed-form SIF geometry functions (Tada / Paris & Irwin),
 * which is equivalent and avoids the need for an embedded table.
 *
 * Normalisation convention (consistent with BeamPrep VBA):
 *   α = a / h   (dimensionless sawcut depth, 0 < α < 1)
 *
 * The four compliance coefficients yy(1..4) in the VBA satisfy:
 *   jointCompliance(1,1) = yy(1) · 2(1−ν²) / (h · E)   [normal DOF]
 *   jointCompliance(2,2) = yy(4) · 2(1−ν²) / (h · E)   [rotational DOF]
 *   yy(2) = yy(3) = 0 (coupling terms, zeroed in BeamPrep)
 *
 * where
 *   yy(1) = ∫₀^α ft(ξ)² dξ
 *   yy(4) = ∫₀^α fb(ξ)² dξ
 */

// ---------------------------------------------------------------------------
// SIF geometry functions  (VBA Sub joint, P1/P2 assignments)
// ---------------------------------------------------------------------------

/**
 * Normalised stress-intensity factor for an edge crack under uniform tensile
 * (axial) stress.  KI = σ_n · √h · ft(α) where σ_n = P/(b·h).
 *
 * VBA variable: ft
 */
export function sifAxial(alpha: number): number {
  const ang = (Math.PI * alpha) / 2;
  return (
    Math.SQRT2 *
    (1 / Math.cos(ang)) *
    (0.752 + 2.02 * alpha + 0.37 * (1 - Math.sin(ang)) ** 3) *
    Math.sqrt(Math.tan(ang))
  );
}

/**
 * Normalised stress-intensity factor for an edge crack under bending stress.
 * KI = σ_b · √h · fb(α) / 6  where σ_b = 6M/(b·h²), so
 * equivalently KI = M/(b·h^(3/2)) · fb(α).
 *
 * VBA variable: fb
 */
export function sifBending(alpha: number): number {
  const ang = (Math.PI * alpha) / 2;
  return (
    6 *
    Math.SQRT2 *
    (1 / Math.cos(ang)) *
    (0.923 + 0.199 * (1 - Math.sin(ang)) ** 4) *
    Math.sqrt(Math.tan(ang))
  );
}

// ---------------------------------------------------------------------------
// Numerical integration (Simpson's rule)
// ---------------------------------------------------------------------------

/**
 * Integrate f from 0 to upper using composite Simpson's rule (n panels, n even).
 * The SIF functions vanish at 0 and grow toward ∞ at α → 1, so typical
 * sawcut values (0.1–0.4) integrate without numerical issues.
 */
function integrate(f: (x: number) => number, upper: number, n = 400): number {
  if (upper <= 1e-15) return 0;
  if (n % 2 !== 0) n += 1;
  const dx = upper / n;
  let sum = f(0) + f(upper);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(i * dx);
  }
  return (sum * dx) / 3;
}

// ---------------------------------------------------------------------------
// Joint properties
// ---------------------------------------------------------------------------

export interface JointCoefficients {
  /**
   * Normalised normal compliance coefficient: yy(1) = ∫₀^α ft² dξ.
   * Divide by E to obtain the actual compliance entry jointData(1,1).
   */
  normalCoeffOverE: number;
  /**
   * Normalised rotational compliance coefficient: yy(4) = ∫₀^α fb² dξ.
   * Divide by E to obtain the actual compliance entry jointData(2,2).
   */
  rotationalCoeffOverE: number;
  /** ft(α) – dimensionless SIF geometry function for axial (normal) loading (P2 in VBA) */
  axialSifCoeff: number;
  /** fb(α) – dimensionless SIF geometry function for bending loading (P1 in VBA) */
  bendingSifCoeff: number;
}

/**
 * Compute joint stiffness/compliance coefficients for a sawcut joint.
 *
 * @param sawcutNormalized  Normalised sawcut depth α = a / h  (dimensionless)
 * @param poissonRatio      Poisson's ratio ν
 * @param thickness         Slab thickness h (in)
 * @returns                 Coefficients ready for use in run.ts
 *
 * VBA equivalent: Sub joint()
 */
export function computeJointCoefficients(
  sawcutNormalized: number,
  poissonRatio: number,
  thickness: number,
): JointCoefficients {
  if (sawcutNormalized <= 0 || sawcutNormalized >= 1) {
    throw new RangeError(
      `sawcutNormalized must be in (0, 1); received ${sawcutNormalized}`,
    );
  }
  if (sawcutNormalized > 0.7) {
    throw new RangeError(
      `sawcutNormalized=${sawcutNormalized} exceeds 0.7; near α=1 the SIF functions are singular and the quadrature becomes unreliable`,
    );
  }

  // VBA: coef = 2*(1 - por^2) / hpcc   (applied before dividing by epcc)
  const coef = (2 * (1 - poissonRatio * poissonRatio)) / thickness;

  const yy1 = integrate((x) => sifAxial(x) ** 2, sawcutNormalized);
  const yy4 = integrate((x) => sifBending(x) ** 2, sawcutNormalized);

  return {
    normalCoeffOverE:     yy1 * coef,
    rotationalCoeffOverE: yy4 * coef,
    axialSifCoeff:        sifAxial(sawcutNormalized),    // ft → P2 in VBA
    bendingSifCoeff:      sifBending(sawcutNormalized),  // fb → P1 in VBA
  };
}
