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
  /** Top-fibre stress-intensity influence coefficient (P1 in VBA) */
  stressCoeffTop: number;
  /** Bottom-fibre stress-intensity influence coefficient (P2 in VBA) */
  stressCoeffBottom: number;
}

/**
 * Parameters for the placeholder rate-type creep model.
 * J(t, tʹ) = [1/145 / E_eff(tʹ)] × 10⁶ × [1 + a1·(1 − e^{−(t−tʹ)/a2(tʹ)})] / 1000
 * where E_eff(tʹ) = −12.135 + 7.9557·ln(tʹ)  (placeholder, GPa-scale)
 *       a2(tʹ)   = a2Scale · e^{tʹ · a2Rate}
 */
export interface CreepModelParams {
  /** Creep coefficient multiplier (a1 in VBA, default 1) */
  a1: number;
  /** Creep time-constant pre-exponential factor (default 15) */
  a2Scale: number;
  /** Creep time-constant exponential rate (default 0.0072) */
  a2Rate: number;
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
  /** Joint properties – defaults to a free joint when omitted */
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
  /** Edge bending stress (psi) */
  bendingStress: number;
  /** Normal (axial) stress at slab mid-plane (psi) */
  normalStress: number;
  /** Total stress = normal + bending (psi) */
  totalStress: number;
}

/** Creep-adjusted result for one hour (post B-matrix transformation) */
export interface CreepStressResult {
  hour: number;
  /** Creep-adjusted stress intensity factor (psi·in^0.5) */
  creepKI: number;
  /** Creep-adjusted total stress (psi) */
  creepTotalStress: number;
}

/** Full output of the stress & creep model */
export interface StressOutput {
  /** Elastic results, one entry per hour */
  hourlyResults: HourlyStressResult[];
  /** Creep-adjusted results (B-matrix applied to elastic stresses) */
  creepResults: CreepStressResult[];
}
