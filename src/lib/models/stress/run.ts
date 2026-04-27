/**
 * Main runner for the stress & creep analysis.
 *
 * Converted from VBA Sub main() → createCreep → creepTransform → transformTemp
 * → BeamPrep → creepResults in CreepModule + BeamModule.
 *
 * Workflow:
 *   1. Build creep compliance and Riesz transformation matrices (B, B⁻¹)
 *   2. Apply B⁻¹ to temperature load histories → pseudo-temperature histories
 *   3. Run elastic beam-on-foundation analysis per hour using pseudo-temperatures
 *   4. Apply B to elastic stress/KI histories → creep-adjusted results
 */

import {
  buildCreepCompliance,
  buildDifferentialCreep,
  buildTransformationMatrix,
  buildInverseTransformation,
  DEFAULT_CREEP_PARAMS,
} from './creep';
import {
  radiusOfRelativeStiffness,
  computeBeamRotation,
  computeHorizontalFriction,
  edgeBendingFactor,
} from './beam';
import { computeJointCoefficients } from './joint';
import { matVec2, solve2x2, lowerTriMatVec } from './linalg';
import type {
  StressModelInput,
  StressOutput,
  HourlyStressResult,
  CreepStressResult,
  JointProperties,
} from './types';

// ---------------------------------------------------------------------------
// Default joint properties (free joint: no translational or rotational restraint)
// ---------------------------------------------------------------------------

const DEFAULT_JOINT: Required<JointProperties> = {
  normalStiffnessOverE: 0,
  rotationalStiffnessOverE: 0,
  axialSifCoeff: 0,
  bendingSifCoeff: 0,
};

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run the full stress & creep analysis.
 *
 * @param input  StressModelInput bundle
 * @returns      Elastic hourly results + creep-adjusted results
 */
export function runStressModel(input: StressModelInput): StressOutput {
  const { startHour, hourlyInputs } = input;
  const endHour = input.endHour ?? 72;
  const nt = endHour - startHour + 1;

  if (hourlyInputs.length !== nt) {
    throw new RangeError(
      `hourlyInputs has ${hourlyInputs.length} entries but startHour=${startHour} to endHour=${endHour} requires ${nt}`,
    );
  }

  const slab = input.slab;

  if (slab.thickness <= 0) throw new RangeError('slab.thickness must be positive');
  if (slab.kValue <= 0)    throw new RangeError('slab.kValue must be positive');
  if (slab.poissonRatio < 0 || slab.poissonRatio >= 0.5) {
    throw new RangeError('slab.poissonRatio must be in [0, 0.5)');
  }
  const creepParams = { ...DEFAULT_CREEP_PARAMS, ...(input.creep ?? {}) };

  const h         = slab.thickness;
  const nu        = slab.poissonRatio;
  const cote      = slab.cote;
  const k         = slab.kValue;
  const spaceJT   = slab.jointSpacingFt * 12;           // ft → in
  const kh        = slab.frictionCoefficient;

  // -------------------------------------------------------------------------
  // Resolve joint geometry-dependent coefficients (constant across hours)
  // -------------------------------------------------------------------------
  // sawcutNormalized takes precedence over manually supplied joint overrides.
  // The compliance entries are  coeff / E  and are re-scaled each hour.

  let jointCoeffNormal = 0;
  let jointCoeffRotational = 0;
  let axialSifCoeff = 0;
  let bendingSifCoeff = 0;

  if (input.sawcutNormalized !== undefined) {
    const jc = computeJointCoefficients(input.sawcutNormalized, nu, h);
    jointCoeffNormal     = jc.normalCoeffOverE;
    jointCoeffRotational = jc.rotationalCoeffOverE;
    axialSifCoeff        = jc.axialSifCoeff;
    bendingSifCoeff      = jc.bendingSifCoeff;
  } else {
    const j: Required<JointProperties> = { ...DEFAULT_JOINT, ...(input.joint ?? {}) };
    jointCoeffNormal     = j.normalStiffnessOverE;
    jointCoeffRotational = j.rotationalStiffnessOverE;
    axialSifCoeff        = j.axialSifCoeff;
    bendingSifCoeff      = j.bendingSifCoeff;
  }

  // -------------------------------------------------------------------------
  // Step 1: Build creep compliance and Riesz transformation matrices
  // -------------------------------------------------------------------------

  const J    = buildCreepCompliance(startHour, nt, creepParams);
  const dJ   = buildDifferentialCreep(J);
  const B    = buildTransformationMatrix(dJ);
  const Binv = buildInverseTransformation(B);

  // -------------------------------------------------------------------------
  // Step 2: Extract raw temperature histories and apply B⁻¹ (transformTemp)
  // -------------------------------------------------------------------------

  const rawUniform  = hourlyInputs.map(h => h.uniformTempChange);
  const rawGradient = hourlyInputs.map(h => h.gradientTempChange);

  const pseudoUniform  = lowerTriMatVec(Binv, rawUniform);
  const pseudoGradient = lowerTriMatVec(Binv, rawGradient);

  // -------------------------------------------------------------------------
  // Step 3: Elastic beam analysis with pseudo-temperatures (BeamPrep)
  // -------------------------------------------------------------------------

  const hourlyResults: HourlyStressResult[] = [];
  const kiHistory: number[]    = [];
  const stressHistory: number[] = [];

  for (let i = 0; i < nt; i++) {
    const row = hourlyInputs[i];
    const E   = row.elasticModulus;

    if (E <= 0) {
      // Before concrete set – skip (store zeros for creep transform alignment)
      kiHistory.push(0);
      stressHistory.push(0);
      hourlyResults.push(zeroResult(row.hour, E));
      continue;
    }

    const El    = E / (1 - nu * nu);                    // plane-stress modulus
    const DTC2  = pseudoUniform[i];                     // uniform ΔT (pseudo)
    const dt2   = pseudoGradient[i];                    // gradient ΔT (pseudo)

    const ell    = radiusOfRelativeStiffness(E, h, nu, k);
    const spaceND = spaceJT / ell;

    const eps0        = cote * DTC2;
    const normalForce = eps0 * h * E;
    const momTemp     = (-E * h * h / (12 * (1 - nu))) * cote * dt2;
    const momTempND   = momTemp / (ell * ell * k);

    // Rotation at joint from temperature gradient (beamEL)
    const thetaND = computeBeamRotation(spaceND, momTempND);
    const theta   = (thetaND / ell) * 2;               // both faces of joint

    // Horizontal friction: joint opening and mid-slab stress (horizontal1)
    const { uc: ucHalf, stressC } = computeHorizontalFriction(kh, El, h, spaceJT, eps0);
    const uc = ucHalf * 2;                              // both faces of joint

    // Plate effective stiffness matrix (force / displacement).
    // Guard against 0/0 when thermal loading is zero (e.g. after B⁻¹
    // transformation reduces a constant temperature history to a single
    // impulse, leaving subsequent pseudo-temperatures at zero).
    const plateK00 = Math.abs(uc) > 1e-30 ? normalForce / (uc / h) : 0;
    const plateK11 = Math.abs(theta) > 1e-30 ? (momTemp / h) / theta : 0;
    const jointPlate1: number[][] = [
      [plateK00, 0],
      [0, plateK11],
    ];

    // Joint compliance matrix: coefficients / E (E varies each hour).
    // With sawcutNormalized, coefficients are geometry integrals; otherwise
    // they are the manually supplied stiffness-over-E values.
    const jointDataRaw: number[][] = [
      [jointCoeffNormal / E, 0],
      [0, jointCoeffRotational / E],
    ];
    // Invert to get joint stiffness (handle zero entries)
    const jointData1 = safeInverse2x2(jointDataRaw);

    // Combined stiffness = plate + joint
    const jointPlateTot1: number[][] = [
      [jointPlate1[0][0] + jointData1[0][0], jointPlate1[0][1] + jointData1[0][1]],
      [jointPlate1[1][0] + jointData1[1][0], jointPlate1[1][1] + jointData1[1][1]],
    ];

    // Free thermal displacement vector
    const resp0 = [uc / h, theta];

    // Free thermal force = plate stiffness × free displacement
    const force1 = matVec2(jointPlate1, resp0);

    // Joint displacement from compatibility
    const [respJ] = solve2x2(jointPlateTot1, force1);

    // Joint reaction forces
    const forceJ = matVec2(jointData1, respJ);

    // Stress intensity factor at joint (KI)
    // VBA: -1/√h · (forceJ(1)·P2 + forceJ(2)·P1) where P1=fb, P2=ft
    const KI = -(1 / Math.sqrt(h)) *
               (forceJ[0] * axialSifCoeff + forceJ[1] * bendingSifCoeff);

    // Bending stress at slab edge (signed – preserves linearity through creep transform).
    // Guard: if momTemp ≈ 0, forceJ[1] is also 0 but the ratio is 0/0 → NaN.
    const sfRaw = edgeBendingFactor(spaceND);
    let stressB = 0;
    if (Math.abs(momTemp) > 1e-30) {
      const sf1 = (sfRaw - 1) * forceJ[1] * h / momTemp;
      stressB = (E * cote * dt2 / 2) * (1 + sf1);
    }

    // Normal (axial) stress
    const stressC0 = El * (-eps0);
    const wt       = normalForce !== 0 ? forceJ[0] / normalForce : 0;
    const stressC1 = (1 - wt) * stressC + wt * stressC0;

    const totalStress = stressC1 + stressB;

    kiHistory.push(KI);
    stressHistory.push(totalStress);

    hourlyResults.push({
      hour:                      row.hour,
      elasticModulus:            E,
      radiusOfRelativeStiffness: ell,
      normalForce,
      temperatureMoment:         momTemp,
      jointNormalForce:          forceJ[0],
      jointMomentPerH:           forceJ[1],
      stressIntensityKI:         KI,
      bendingStress:             stressB,
      normalStress:              stressC1,
      totalStress,
    });
  }

  // -------------------------------------------------------------------------
  // Step 4: Apply B to elastic histories → creep-adjusted results (creepResults)
  // -------------------------------------------------------------------------

  const creepKIHistory    = lowerTriMatVec(B, kiHistory);
  const creepStressHistory = lowerTriMatVec(B, stressHistory);

  const creepResults: CreepStressResult[] = hourlyResults.map((r, i) => ({
    hour:             r.hour,
    creepKI:          creepKIHistory[i],
    creepTotalStress: creepStressHistory[i],
  }));

  return { hourlyResults, creepResults };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zeroResult(hour: number, E: number): HourlyStressResult {
  return {
    hour,
    elasticModulus:            E,
    radiusOfRelativeStiffness: 0,
    normalForce:               0,
    temperatureMoment:         0,
    jointNormalForce:          0,
    jointMomentPerH:           0,
    stressIntensityKI:         0,
    bendingStress:             0,
    normalStress:              0,
    totalStress:               0,
  };
}

/**
 * Invert a 2×2 diagonal-only compliance matrix safely.
 * Off-diagonal terms are forced to zero (VBA multiplies them by 0 anyway).
 * A zero diagonal entry → zero stiffness (free joint in that DOF).
 */
function safeInverse2x2(M: number[][]): number[][] {
  const k00 = Math.abs(M[0][0]) > 1e-30 ? 1 / M[0][0] : 0;
  const k11 = Math.abs(M[1][1]) > 1e-30 ? 1 / M[1][1] : 0;
  return [
    [k00, 0],
    [0, k11],
  ];
}

