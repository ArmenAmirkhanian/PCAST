/**
 * Types for the Stress & Creep Analysis Module
 *
 * Converted from VBA macros: CreepModule + BeamModule (PCAST spreadsheet).
 * The model uses a rate-type creep formulation via Riesz transformation
 * matrices (B and B⁻¹) applied to a Winkler-foundation beam analysis of a
 * concrete slab panel with a transverse joint.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Slab material and geometry properties */
export interface SlabProperties {
  /** Slab thickness (in) */
  thickness: number;
  /** Poisson's ratio (dimensionless) */
  poissonRatio: number;
  /** Coefficient of thermal expansion (1/°F) */
  cote: number;
  /** Modulus of subgrade reaction (psi/in) */
  kValue: number;
  /** Joint spacing (ft) – converted to inches internally */
  jointSpacingFt: number;
  /** Horizontal friction coefficient between slab and base (psi/in) */
  frictionCoefficient: number;
}

/**
 * Joint stiffness properties.
 * Stiffness values are per unit elastic modulus so the ratio scales with E.
 * Set to 0 for a fully open (free) joint; large values approach a rigid joint.
 */
export interface JointProperties {
  /** Normal (translational) stiffness / E (dimensionless) */
  normalStiffnessOverE: number;
  /** Rotational stiffness / E (dimensionless) */
  rotationalStiffnessOverE: number;
  /** ft – dimensionless SIF geometry function for axial (normal) loading (P2 in VBA) */
  axialSifCoeff: number;
  /** fb – dimensionless SIF geometry function for bending loading (P1 in VBA) */
  bendingSifCoeff: number;
}

/**
 * Aging-modulus model that supplies E(tʹ) to the creep compliance kernel.
 *
 * All three are bounded and strictly positive for every loading age tʹ > 0
 * (they decay to zero only as tʹ → 0), so none reproduce the negative-modulus
 * pathology of the old logarithmic placeholder.
 *
 *  • 'hydration' – uses the model's own per-hour stiffness
 *                  E(tʹ) = E_mature · α(tʹ)/α_u, i.e. the SAME modulus the beam
 *                  analysis sees. Most internally consistent; needs no extra
 *                  inputs. Default.
 *  • 'cebFip'    – CEB-FIP MC90 / Eurocode 2 closed form
 *                  β_cc(tʹ) = exp{ s·[1 − √(28/tʹ_days)] },  E(tʹ) = √β_cc · E₂₈.
 *                  Needs only the cement-type coefficient s.
 *  • 'aemm'      – Age-Adjusted Effective Modulus shortcut (Trost / Bažant):
 *                  the hydration modulus with the creep coefficient down-weighted
 *                  by the aging coefficient χ, J = (1 + χ·φ)/E_hydration(tʹ).
 *                  χ = 1 recovers the standard effective-modulus kernel.
 *
 * Note: E(tʹ) always cancels out of the pseudo-load transform (see creep.ts),
 * so 'hydration' and 'cebFip' — which share the same φ shape and χ = 1 —
 * produce IDENTICAL creep-adjusted stress; only χ (via 'aemm') or a change to
 * φ's own shape parameters (a1, a2Scale, a2Rate) changes the result. Distinct
 * E(tʹ) profiles matter only if they also feed the elastic beam solve, which
 * 'cebFip' deliberately does not.
 */
export type CreepModel = 'hydration' | 'cebFip' | 'aemm';

/** CEB-FIP / EC2 cement-type strength-gain coefficient s. */
export type CebFipCement = 'rapid' | 'normal' | 'slow';

/**
 * Parameters for the rate-type creep model.
 *
 * Compliance kernel (lower-triangular, scale-invariant — see creep.ts):
 *   J(t, tʹ) = [1 + χ·φ(t, tʹ)] / E(tʹ)
 *   φ(t, tʹ) = a1·(1 − e^{−(t−tʹ)/a2(tʹ)}),   a2(tʹ) = a2Scale · e^{tʹ · a2Rate}
 * where E(tʹ) is the bounded aging modulus chosen by `creepModel` and χ is the
 * aging coefficient (1 for the 'hydration'/'cebFip' kernels, `agingCoefficient`
 * for 'aemm').
 */
export interface CreepModelParams {
  /** Creep coefficient multiplier (a1 in VBA, default 1) */
  a1: number;
  /** Creep time-constant pre-exponential factor (default 15) */
  a2Scale: number;
  /** Creep time-constant exponential rate (default 0.0072) */
  a2Rate: number;
  /** Which bounded aging-modulus model feeds the compliance (default 'hydration'). */
  creepModel: CreepModel;
  /**
   * Aging coefficient χ for the 'aemm' model (Trost / Bažant, ≈0.6–0.9; 0.8
   * typical). Ignored by the 'hydration' and 'cebFip' kernels (which use χ = 1).
   */
  agingCoefficient: number;
  /**
   * CEB-FIP / EC2 cement-type coefficient s for the 'cebFip' model
   * (rapid-hardening 0.20, normal 0.25, slow 0.38). Ignored by other models.
   */
  cebFipS: number;
}

/** Per-hour input data required by the stress model */
export interface HourlyInput {
  /** Absolute hour index (e.g. 1–72) */
  hour: number;
  /** Elastic modulus at this hour (psi) from the hydration model */
  elasticModulus: number;
  /** Uniform temperature change ΔT_c (°F) – average through slab thickness */
  uniformTempChange: number;
  /** Temperature gradient ΔT_g (°F) – top minus bottom surface */
  gradientTempChange: number;
  /**
   * Concrete tensile strength at this hour (psi) from the maturity model — the
   * cracking capacity the creep-adjusted tensile demand is checked against.
   *
   * When the demand reaches this value while the slab is still continuous (i.e.
   * before the saw-cut), a natural crack forms: the slab stops being modelled
   * as an infinite panel and becomes a cracked finite panel from that hour on
   * (see `SlabRegime` and `CrackingAssessment`).
   *
   * Omitted or ≤ 0 ⇒ no capacity known for that hour, so the natural-cracking
   * check is skipped there.
   */
  tensileStrength?: number;
}

/** Full input bundle for the stress & creep runner */
export interface StressModelInput {
  /**
   * Index of the first hour to analyse (set time, n0 in VBA).
   * Typically the concrete set time from the hydration model.
   */
  startHour: number;
  /** Last hour to analyse (nf in VBA, default 72) */
  endHour?: number;
  slab: SlabProperties;
  /**
   * Hour index (same 1-based grid as `hourlyInputs[].hour`, hour 1 = placement)
   * at which the transverse saw-cut joint is created.
   *
   * For hours BEFORE this the panel is continuous — no joint and no free edge —
   * so it is modelled as an infinite slab: thermal actions are fully restrained
   * (maximum curling/axial stress) and the Mode-I stress intensity KI = 0. At
   * and after this hour the joint exists (free edge + sawcut compliance) and the
   * finite-panel beam-on-foundation analysis applies.
   *
   * The infinite-slab idealisation only holds while the section is intact: if
   * `hourlyInputs[].tensileStrength` is supplied and the creep-adjusted demand
   * reaches it first, the slab cracks naturally at that hour and is finite from
   * then on (`CrackingAssessment.verdict = 'crackedBeforeSawCut'`).
   *
   * Omitted ⇒ the joint is treated as present for the whole window (legacy
   * behaviour; matches a slab that was already jointed before the analysis
   * begins).
   */
  sawCutHour?: number;
  /**
   * Normalised sawcut depth α = sawcutDepth / slabThickness (dimensionless, 0–1).
   * When provided the joint stiffness and stress-intensity coefficients are
   * computed from fracture-mechanics integrals (joint.ts).  Takes precedence
   * over the manual `joint` override below.
   */
  sawcutNormalized?: number;
  /**
   * Manual joint property override.
   * Used only when `sawcutNormalized` is not provided.
   * Defaults to a free (open) joint when both are omitted.
   */
  joint?: Partial<JointProperties>;
  /** Creep model parameters – defaults applied when omitted */
  creep?: Partial<CreepModelParams>;
  /**
   * Per-hour data array.
   * Must contain one entry for each hour from startHour to endHour (inclusive).
   */
  hourlyInputs: HourlyInput[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * Restraint regime that produced an hour's result.
 *
 *  • 'continuous' – no transverse discontinuity yet (before the saw-cut and
 *                   before any natural crack). Modelled as an infinite slab:
 *                   thermal actions at their fully-restrained maxima, KI = 0.
 *  • 'jointed'    – the saw-cut joint exists: finite panel with a free edge and
 *                   the sawcut joint's compliance redistributing the actions.
 *  • 'cracked'    – a natural (uncontrolled) full-depth crack has formed because
 *                   the tensile demand reached the tensile strength while the
 *                   slab was still continuous. The crack is a free edge with no
 *                   ligament left to transfer force, so axial restraint drops to
 *                   base friction over the panel and KI = 0 (there is no crack
 *                   tip inside the section any more). Once cracked the slab stays
 *                   cracked for the rest of the window — a later saw-cut cannot
 *                   undo it.
 */
export type SlabRegime = 'continuous' | 'jointed' | 'cracked';

/** Elastic (time-independent) stress results for one hour */
export interface HourlyStressResult {
  hour: number;
  elasticModulus: number;
  /** Radius of relative stiffness, ℓ (in) */
  radiusOfRelativeStiffness: number;
  /** Thermal normal force per unit width (lb/in) */
  normalForce: number;
  /** Thermal bending moment per unit width (lb·in/in) */
  temperatureMoment: number;
  /** Joint normal force per unit width (lb/in) */
  jointNormalForce: number;
  /** Joint moment divided by slab thickness (lb/in) */
  jointMomentPerH: number;
  /** Mode-I stress intensity factor KI (psi·in^0.5) */
  stressIntensityKI: number;
  /**
   * Signed edge bending stress (psi). Positive per the model's sign
   * convention (tension positive). Previously this was `Math.abs`-wrapped;
   * the signed value is retained so the creep transform sees a true,
   * sign-reversing history (see explanation §21.4).
   */
  bendingStress: number;
  /** Normal (axial) stress at slab mid-plane (psi), signed (tension +) */
  normalStress: number;
  /** Total stress = normal + signed bending (psi) — equals stressTop */
  totalStress: number;
  // --- Signed extreme-fibre stresses (explanation §23.3 / §30.3) ----------
  /** Top-fibre stress = normalStress + bendingStress (psi, tension +) */
  stressTop: number;
  /** Bottom-fibre stress = normalStress − bendingStress (psi, tension +) */
  stressBottom: number;
  /** Most tensile of the two faces this hour = max(stressTop, stressBottom) */
  maxTensileStress: number;
  // --- Diagnostics (explanation §30.11) -----------------------------------
  /** Pseudo-uniform temperature DTC* used this hour (°F) — post B⁻¹ */
  pseudoUniformTemp: number;
  /** Pseudo-gradient temperature ΔT_g* used this hour (°F) — post B⁻¹ */
  pseudoGradientTemp: number;
  /** Raw edge bending factor sfRaw = edgeBendingFactor(spaceND) */
  edgeBendingFactor: number;
  /** False if the 2×2 joint compatibility system was singular this hour */
  solverOk: boolean;
  /** Restraint regime this row was solved in (see `SlabRegime`) */
  regime: SlabRegime;
}

/** Creep-adjusted result for one hour (post B-matrix transformation) */
export interface CreepStressResult {
  hour: number;
  /** Creep-adjusted stress intensity factor (psi·in^0.5) */
  creepKI: number;
  /** Creep-adjusted total stress (psi) — B applied to totalStress history */
  creepTotalStress: number;
  /** Creep-adjusted top-fibre stress (psi) — B applied to stressTop history */
  creepStressTop: number;
  /** Creep-adjusted bottom-fibre stress (psi) — B applied to stressBottom history */
  creepStressBottom: number;
  /** Most tensile creep-adjusted face = max(creepStressTop, creepStressBottom) */
  creepMaxTensile: number;
  // --- Cracking check (explanation §stressCreepTheory) ---------------------
  /** Tensile capacity used at this hour (psi); 0 when no strength was supplied */
  tensileStrength: number;
  /**
   * creepMaxTensile / tensileStrength for this hour (0 when no strength was
   * supplied). ≥ 1 means the section has reached its capacity. At the hour a
   * natural crack forms this is the *relieved* (post-crack) ratio — the demand
   * that triggered the crack is `CrackingAssessment.crackDemand`.
   */
  demandCapacityRatio: number;
  /** True from the natural-crack hour onward (the slab carries a crack) */
  cracked: boolean;
}

/** Outcome of the saw-cut timing check. */
export type SawCutVerdict =
  /** Saw-cut timing is adequate: no natural crack before the cut. */
  | 'ok'
  /** The slab reached its tensile strength and cracked before the saw-cut. */
  | 'crackedBeforeSawCut'
  /** No tensile-strength data supplied — the cracking check could not run. */
  | 'noStrengthData'
  /** No pre-cut window to assess (no saw-cut hour, or it precedes the set time). */
  | 'jointedThroughout';

/**
 * Whether the slab cracks on its own before the proposed saw-cut — the question
 * the tool exists to answer.
 *
 * A natural crack is declared at the first hour where the creep-adjusted tensile
 * demand (`creepMaxTensile`) reaches the tensile strength while the slab is still
 * continuous. From that hour the slab is no longer modelled as an infinite panel
 * (see `SlabRegime` = 'cracked').
 */
export interface CrackingAssessment {
  /** Verdict on the proposed saw-cut time */
  verdict: SawCutVerdict;
  /** Saw-cut hour the verdict was formed against (echo of the input) */
  sawCutHour?: number;
  /** Hour at which the natural crack forms; undefined = no crack in the window */
  naturalCrackHour?: number;
  /** Creep-adjusted tensile demand that triggered the crack (psi) */
  crackDemand?: number;
  /** Tensile strength at the crack hour (psi) */
  crackStrength?: number;
  /** Peak demand/capacity ratio reached while the slab was continuous (pre-cut) */
  preCutPeakRatio?: number;
  /** Hour of `preCutPeakRatio` */
  preCutPeakRatioHour?: number;
  /**
   * Hours where the demand still reaches the strength after a joint or crack has
   * relieved the slab. These indicate further (secondary) cracking that the
   * single-crack model does not subdivide the panel for.
   */
  exceedanceHoursAfterRelief: number[];
}

/** Full output of the stress & creep model */
export interface StressOutput {
  /** Elastic results, one entry per hour */
  hourlyResults: HourlyStressResult[];
  /** Creep-adjusted results (B-matrix applied to elastic stresses) */
  creepResults: CreepStressResult[];
  /** Natural-cracking / saw-cut-timing assessment */
  cracking: CrackingAssessment;
  /** Non-fatal diagnostics raised during the run (singular hours, etc.) */
  warnings: string[];
}
