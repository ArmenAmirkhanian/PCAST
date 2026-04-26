/**
 * Beam-on-elastic-foundation analysis for a concrete slab panel.
 *
 * Converted from VBA Sub beamEL() and Sub horizontal1() in BeamModule.
 *
 * Coordinate system:
 *   - x = 0 at slab centre, x = L = jointSpacing/2 at the joint
 *   - Non-dimensional coordinate: ξ = x / ℓ  (ℓ = radius of relative stiffness)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Radius of relative stiffness ℓ (in) for a slab on a Winkler foundation */
export function radiusOfRelativeStiffness(
  E: number,       // elastic modulus (psi)
  h: number,       // slab thickness (in)
  nu: number,      // Poisson's ratio
  k: number,       // modulus of subgrade reaction (psi/in)
): number {
  return ((E * h * h * h) / (12 * (1 - nu * nu) * k)) ** 0.25;
}

// ---------------------------------------------------------------------------
// Winkler-foundation beam rotation at the joint (Sub beamEL)
// ---------------------------------------------------------------------------

/**
 * Compute the non-dimensional rotation θ̄ at the joint edge (x = L/2 = A·ℓ)
 * for a Winkler-beam slab loaded by a temperature gradient moment.
 *
 * Based on the exact closed-form solution of the 4th-order ODE:
 *   d⁴w/dξ⁴ + 4w = q̄
 * with symmetry (even) boundary conditions at ξ = 0 and free-end conditions
 * at ξ = A.
 *
 * @param spaceND    Non-dimensional joint spacing L/ℓ
 * @param momTempND  Non-dimensional temperature moment M_T / (ℓ² · k)
 * @returns          Non-dimensional rotation at joint, scaled by momTempND
 *
 * VBA: Sub beamEL()
 */
export function computeBeamRotation(spaceND: number, momTempND: number): number {
  const A = spaceND / 2;                          // non-dim half-length
  const S2 = Math.SQRT2;

  const cosA  = Math.cos(A / S2);
  const sinA  = Math.sin(A / S2);
  const tanA  = Math.tan(A / S2);
  const eA    = Math.exp(A / S2);                 // e^{A/√2}
  const eNegA = Math.exp(-A / S2);               // e^{-A/√2}
  const eSqA  = Math.exp(S2 * A);                // e^{√2·A}
  const e2SqA = Math.exp(2 * S2 * A);            // e^{2√2·A}

  // Integration constants c1 and c3 for the cosine-mode and sine-mode
  const num1   = eA * (-cosA + e2SqA * cosA - sinA - e2SqA * sinA);
  const denom1 = -cosA * cosA + e2SqA * cosA * cosA
                 + 4 * eSqA * cosA * sinA
                 - sinA * sinA + e2SqA * sinA * sinA;
  const c1 = num1 / denom1;

  const num2   = eA * (-1 + e2SqA + tanA + 2 * eSqA * tanA + e2SqA * tanA) / cosA;
  const denom2 = (1 + eSqA) * (-1 + e2SqA + 4 * eSqA * tanA - tanA * tanA + e2SqA * tanA * tanA);
  const c3 = -num2 / denom2;

  // Slope (dw/dξ) at ξ = A (joint edge)
  // Derived by differentiating the general solution w(ξ) at ξ = A
  const q1 = -(cosA / (S2 * eA)) + (eA * cosA) / S2
              - sinA / (S2 * eA) - (eA * sinA) / S2;
  const q3 =   cosA / (S2 * eA) - (eA * cosA) / S2
              - sinA / (S2 * eA) - (eA * sinA) / S2;

  return (q1 * c1 + q3 * c3) * momTempND;
}

// ---------------------------------------------------------------------------
// Horizontal (friction) analysis (Sub horizontal1)
// ---------------------------------------------------------------------------

/**
 * Joint opening displacement and mid-slab friction stress for a slab with
 * distributed horizontal friction restraint.
 *
 * The governing ODE is: EA·u″ − kh·u = −EA·ε₀
 * Solution: u(x) = c₀₁·(−e^{−βx} + e^{βx}) + particular
 *
 * @param kh    Horizontal friction coefficient (psi/in)
 * @param El    E/(1−ν²) – plane-stress modulus (psi)
 * @param h     Slab thickness (in)
 * @param L0    Joint spacing, full length (in)
 * @param eps0  Free thermal strain = COTE × ΔT_c
 * @returns     uc (joint opening, in) and stressC (mid-slab axial stress, psi)
 *
 * VBA: Sub horizontal1()
 */
export function computeHorizontalFriction(
  kh: number,
  El: number,
  h: number,
  L0: number,
  eps0: number,
): { uc: number; stressC: number } {
  const L = L0 / 2;
  const beta = Math.sqrt(kh) / (Math.sqrt(h) * Math.sqrt(El));

  const expPos = Math.exp(beta * L);
  const expNeg = Math.exp(-beta * L);
  const c01 = eps0 / (beta * (expNeg + expPos));          // = eps0 / (2β·cosh(βL))

  // Joint opening at x = L
  const uc = c01 * (-expNeg + expPos);                   // = 2·c01·sinh(βL)

  // Axial stress at slab centre (x = 0)
  const stressC = (-eps0 + beta * c01 * (1 + 1)) * El;  // = El·eps0·(1/cosh(βL) − 1)

  return { uc, stressC };
}

// ---------------------------------------------------------------------------
// Non-dimensional edge-bending stress factor (VBA inline in BeamPrep)
// ---------------------------------------------------------------------------

/**
 * Non-dimensional bending stress reduction factor for a Winkler beam.
 *
 * stressB1 = 1 − 2·cos(s/2√2)·cosh(s/2√2) / [sin(s/√2) + sinh(s/√2)]
 *              × [tan(s/2√2) + tanh(s/2√2)]
 *
 * where s = spaceND (L/ℓ).
 *
 * This factor is applied to the fully-constrained thermal bending stress to
 * account for finite slab length and free-end boundary conditions.
 */
export function edgeBendingFactor(spaceND: number): number {
  const sl = spaceND / Math.sqrt(8);    // = (L/ℓ) / (2√2) = A/√2
  const s2 = spaceND / Math.SQRT2;      // = (L/ℓ) / √2

  const denom = Math.sin(s2) + Math.sinh(s2);
  if (Math.abs(denom) < 1e-30) return 1;

  return (
    1 -
    (2 * Math.cos(sl) * Math.cosh(sl) * (Math.tan(sl) + Math.tanh(sl))) / denom
  );
}
