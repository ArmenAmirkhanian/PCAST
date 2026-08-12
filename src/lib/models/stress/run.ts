/**
 * Main runner for the stress & creep analysis.
 *
 * Loosely converted from VBA Sub main() → createCreep → creepTransform →
 * transformTemp → BeamPrep → creepResults in CreepModule + BeamModule; see
 * creep.ts for the corrected derivation of the pseudo-load transform.
 *
 * Workflow:
 *   1. Build the creep compliance matrix J and the pseudo-load operator B⁻¹
 *   2. Apply B⁻¹ to temperature load histories → pseudo-temperature histories
 *   3. March hour by hour: elastic beam-on-foundation analysis for the hour's
 *      restraint regime, then row i of B (a running sum) → the creep-adjusted
 *      stress at that hour, then the cracking check — which switches the slab
 *      from continuous (infinite) to cracked (finite) the moment the demand
 *      reaches the strength
 *   4. Assemble the cracking / saw-cut-timing assessment
 *
 * Step 3 can be marched hour by hour because B is lower triangular: the
 * creep-adjusted stress at hour i depends only on elastic stresses at hours
 * ≤ i. A regime switch triggered at hour i therefore cannot invalidate rows
 * already emitted, and the whole-history `lowerTriMatVec` of the previous
 * fixed-regime implementation is reproduced exactly when no crack occurs.
 */

import {
  buildCreepCompliance,
  buildPseudoLoadOperator,
  buildCumulativeSumOperator,
  DEFAULT_CREEP_PARAMS,
} from './creep';
import {
  radiusOfRelativeStiffness,
  computeBeamRotation,
  computeHorizontalFriction,
  edgeBendingFactor,
} from './beam';
import { computeJointCoefficients } from './joint';
import { matVec2, lowerTriMatVec, lowerTriRowDot } from './linalg';
import type {
  StressModelInput,
  StressOutput,
  HourlyStressResult,
  CreepStressResult,
  CrackingAssessment,
  SawCutVerdict,
  SlabRegime,
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

  // Hour-alignment check (explanation §30.9): row i must be hour startHour + i,
  // otherwise the creep transformation matrices (built on the assumed grid) and
  // the load histories refer to mismatched times.
  for (let i = 0; i < nt; i++) {
    if (hourlyInputs[i].hour !== startHour + i) {
      throw new RangeError(
        `hourlyInputs[${i}].hour is ${hourlyInputs[i].hour} but must equal startHour + ${i} = ${startHour + i}`,
      );
    }
  }

  const warnings: string[] = [];

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
  const sawCutHour = input.sawCutHour;                  // joint-creation hour (undefined = jointed throughout)

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

  // The 'hydration'/'aemm' creep models reuse the beam analysis' own per-hour
  // stiffness so the compliance kernel and the elastic solve share one E(t).
  const modulusByIndex = hourlyInputs.map(h => h.elasticModulus);
  const J    = buildCreepCompliance(startHour, nt, creepParams, modulusByIndex);
  const Binv = buildPseudoLoadOperator(J, startHour, nt, creepParams, modulusByIndex);
  const B    = buildCumulativeSumOperator(nt);

  // -------------------------------------------------------------------------
  // Step 2: Extract raw temperature histories and apply B⁻¹ (transformTemp)
  // -------------------------------------------------------------------------

  const rawUniform  = hourlyInputs.map(h => h.uniformTempChange);
  const rawGradient = hourlyInputs.map(h => h.gradientTempChange);

  const pseudoUniform  = lowerTriMatVec(Binv, rawUniform);
  const pseudoGradient = lowerTriMatVec(Binv, rawGradient);

  /**
   * Tensile capacity at index i (psi), 0 when none was supplied. Non-finite or
   * negative values are treated as "unknown" so a stray NaN cannot silently
   * declare a crack at the first hour.
   */
  const tensileStrengthAt = (i: number): number => {
    const s = hourlyInputs[i].tensileStrength;
    return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : 0;
  };

  // -------------------------------------------------------------------------
  // Step 3a: Elastic beam analysis for one hour in a given restraint regime
  // (BeamPrep). Pure with respect to the march below — it reads only the
  // resolved slab constants and hour i's loads, so the same hour can be re-solved
  // in a different regime when the cracking check fires.
  // -------------------------------------------------------------------------

  /** Solve hour i elastically; returns the row plus any diagnostics it raised. */
  function solveHour(
    i: number,
    regime: SlabRegime,
  ): { result: HourlyStressResult; hourWarnings: string[] } {
    const hourWarnings: string[] = [];
    const row = hourlyInputs[i];
    const E   = row.elasticModulus;

    if (E <= 0) {
      // Before concrete set – skip (store zeros for creep transform alignment)
      return {
        result: zeroResult(row.hour, E, regime, pseudoUniform[i], pseudoGradient[i]),
        hourWarnings,
      };
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

    // Fully-restrained (infinite-slab) reference stresses, used both as inputs
    // to the jointed solve and directly in the pre-cut continuous regime:
    //   • axial:  σ = −E'·ε₀  (complete friction restraint; a frictionless
    //     interface, kh = 0, carries no axial stress at any length)
    //   • curling: Bradbury finite-length factor → 1 ⇒ σ = E·α·ΔT_g/2
    const stressC0 = El * (-eps0);
    const sfRaw    = edgeBendingFactor(spaceND);        // edge-bending diagnostic

    let forceJ: number[];
    let KI: number;
    let stressB: number;
    let stressC1: number;
    let solverOk = true;

    if (regime === 'jointed') {
      // ---- Finite panel with transverse joint (free edge + sawcut joint) ----

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

      // Joint displacement from compatibility, solved per DOF.
      // jointPlateTot1 is strictly diagonal (off-diagonals are hard-zeroed), so
      // the two DOFs decouple. Solving each independently means a singular DOF
      // (e.g. zero plate rotational stiffness when the pseudo-gradient is zero)
      // yields a zero reaction in THAT DOF only — the correct physical limit —
      // without discarding the well-posed reaction in the other DOF. A shared 2×2
      // determinant would zero both when either diagonal vanished (explanation
      // §19.5, §30.10).
      const kTot0 = jointPlateTot1[0][0];
      const kTot1 = jointPlateTot1[1][1];
      const respJ = [0, 0];
      if (Math.abs(kTot0) > 1e-30) {
        respJ[0] = force1[0] / kTot0;
      } else {
        solverOk = false;
        hourWarnings.push(
          `Hour ${row.hour}: normal-DOF plate+joint stiffness is zero; normal joint reaction set to 0.`,
        );
      }
      if (Math.abs(kTot1) > 1e-30) {
        respJ[1] = force1[1] / kTot1;
      } else {
        solverOk = false;
        hourWarnings.push(
          `Hour ${row.hour}: rotational-DOF plate+joint stiffness is zero; rotational joint reaction set to 0.`,
        );
      }

      // Joint reaction forces
      forceJ = matVec2(jointData1, respJ);

      // Stress intensity factor at joint (KI)
      // VBA: -1/√h · (forceJ(1)·P2 + forceJ(2)·P1) where P1=fb, P2=ft
      KI = -(1 / Math.sqrt(h)) *
           (forceJ[0] * axialSifCoeff + forceJ[1] * bendingSifCoeff);

      // Bending stress at slab edge (signed – preserves linearity through creep transform).
      // Guard: if momTemp ≈ 0, forceJ[1] is also 0 but the ratio is 0/0 → NaN.
      stressB = 0;
      if (Math.abs(momTemp) > 1e-30) {
        const sf1 = (sfRaw - 1) * forceJ[1] * h / momTemp;
        stressB = (E * cote * dt2 / 2) * (1 + sf1);
      }

      // Normal (axial) stress
      const wt = normalForce !== 0 ? forceJ[0] / normalForce : 0;
      stressC1 = (1 - wt) * stressC + wt * stressC0;
    } else if (regime === 'cracked') {
      // ---- Finite panel broken by a natural full-depth crack ----------------
      // The crack has already run through the whole section, so nothing is left
      // to transfer force across it: it is the zero-stiffness (free-edge) limit
      // of the jointed solve above, reached here in closed form.
      //   • axial: with the restraint released at the crack face, the only
      //     remaining restraint is base friction accumulated over the panel —
      //     the finite-length σ(x=0) = E'·ε₀·(1/cosh βL − 1), far below the
      //     fully-restrained −E'·ε₀ of the continuous slab. This is the relief
      //     that a crack (or a saw-cut) buys.
      //   • curling: with no joint moment (forceJ[1] = 0) the jointed blend
      //     above reduces to the same fully-restrained value, so the bending
      //     term is carried across unrelieved — the conservative choice, and
      //     exact for the long panels where sfRaw → 1 anyway.
      //   • KI = 0: there is no ligament left ahead of a crack tip, so the
      //     sawcut SIF geometry no longer applies.
      const { stressC } = computeHorizontalFriction(kh, El, h, spaceJT, eps0);
      forceJ   = [0, 0];
      KI       = 0;
      stressB  = (E * cote * dt2) / 2;
      stressC1 = stressC;
    } else {
      // ---- Continuous (infinite) slab: joint not yet cut, section intact ----
      // No transverse joint and no free edge → no joint reactions and no crack
      // tip, so KI = 0. The thermal actions are fully restrained: curling at the
      // Bradbury C = 1 limit and axial at complete friction restraint (zero on a
      // frictionless interface). These are the maxima the relieved jointed
      // analysis later relaxes below — and the demand the cracking check tests,
      // because this idealisation only survives while the section is intact.
      forceJ   = [0, 0];
      KI       = 0;
      stressB  = (E * cote * dt2) / 2;
      stressC1 = kh > 0 ? stressC0 : 0;
    }

    // Signed extreme-fibre stresses (explanation §23.3).
    // The creep transform is applied to each signed face history separately so
    // that diurnal gradient reversals (which put tension on opposite faces) are
    // not collapsed into a single magnitude.
    const totalStress  = stressC1 + stressB;   // === stressTop
    const stressTop    = stressC1 + stressB;
    const stressBottom = stressC1 - stressB;

    return {
      result: {
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
        stressTop,
        stressBottom,
        maxTensileStress:          Math.max(stressTop, stressBottom),
        pseudoUniformTemp:         DTC2,
        pseudoGradientTemp:        dt2,
        edgeBendingFactor:         sfRaw,
        solverOk,
        regime,
      },
      hourWarnings,
    };
  }

  // -------------------------------------------------------------------------
  // Step 3b: March the hours, applying B row by row and checking for cracking
  // -------------------------------------------------------------------------

  const hourlyResults: HourlyStressResult[] = [];
  const creepResults: CreepStressResult[]   = [];

  // Elastic histories, filled as the march advances (index i = hour startHour+i).
  const kiHistory     = new Array<number>(nt).fill(0);
  const stressHistory = new Array<number>(nt).fill(0);
  const topHistory    = new Array<number>(nt).fill(0);
  const bottomHistory = new Array<number>(nt).fill(0);

  /** Store hour i's elastic stresses, then apply row i of B to the history. */
  function creepRowFor(
    i: number,
    r: HourlyStressResult,
    strength: number,
    cracked: boolean,
  ): CreepStressResult {
    kiHistory[i]     = r.stressIntensityKI;
    stressHistory[i] = r.totalStress;
    topHistory[i]    = r.stressTop;
    bottomHistory[i] = r.stressBottom;

    const top    = lowerTriRowDot(B, topHistory, i);
    const bottom = lowerTriRowDot(B, bottomHistory, i);
    const maxTensile = Math.max(top, bottom);

    return {
      hour:                r.hour,
      creepKI:             lowerTriRowDot(B, kiHistory, i),
      creepTotalStress:    lowerTriRowDot(B, stressHistory, i),
      creepStressTop:      top,
      creepStressBottom:   bottom,
      creepMaxTensile:     maxTensile,
      tensileStrength:     strength,
      demandCapacityRatio: strength > 0 ? maxTensile / strength : 0,
      cracked,
    };
  }

  let cracked = false;                             // natural crack has formed
  let naturalCrackHour: number | undefined;
  let crackDemand: number | undefined;
  let crackStrength: number | undefined;
  let preCutPeakRatio: number | undefined;
  let preCutPeakRatioHour: number | undefined;
  const exceedanceHoursAfterRelief: number[] = [];

  for (let i = 0; i < nt; i++) {
    const row = hourlyInputs[i];
    const strength = tensileStrengthAt(i);

    // Regime for this hour. A natural crack is permanent: it outranks the
    // saw-cut, because a slab that has already broken cannot be un-broken by
    // cutting it later, and the through-depth crack is the more compliant of
    // the two discontinuities.
    const jointCut = sawCutHour === undefined || row.hour >= sawCutHour;
    let regime: SlabRegime = cracked ? 'cracked' : jointCut ? 'jointed' : 'continuous';

    let solved   = solveHour(i, regime);
    let creepRow = creepRowFor(i, solved.result, strength, cracked);

    if (regime === 'continuous' && strength > 0) {
      const ratio = creepRow.demandCapacityRatio;
      if (preCutPeakRatio === undefined || ratio > preCutPeakRatio) {
        preCutPeakRatio     = ratio;
        preCutPeakRatioHour = row.hour;
      }

      if (creepRow.creepMaxTensile >= strength) {
        // The slab breaks here: the continuous (infinite-slab) idealisation has
        // run out of capacity, so a natural transverse crack forms and the panel
        // is finite from this hour on. Hour i is re-solved in the cracked regime
        // — the crack forms during this hour, so its own end-of-hour state is
        // already relieved. B is lower triangular, so replacing history entry i
        // only affects this row and later ones, which have not been solved yet.
        cracked          = true;
        naturalCrackHour = row.hour;
        crackDemand      = creepRow.creepMaxTensile;
        crackStrength    = strength;
        regime           = 'cracked';

        solved   = solveHour(i, regime);
        creepRow = creepRowFor(i, solved.result, strength, true);

        warnings.push(
          `Hour ${row.hour}: creep-adjusted tensile demand (${crackDemand.toFixed(1)} psi) ` +
          `reached the tensile strength (${strength.toFixed(1)} psi) while the slab was still ` +
          `continuous — a natural crack forms and the slab is modelled as a cracked (finite) ` +
          `panel from this hour on.`,
        );
        if (sawCutHour !== undefined && row.hour < sawCutHour) {
          warnings.push(
            `The natural crack at hour ${row.hour} precedes the saw-cut at hour ${sawCutHour}: ` +
            `results from hour ${row.hour} onward describe the cracked slab, and Kᵢ is reported ` +
            `as 0 because the through-depth crack — not the saw-cut ligament — governs.`,
          );
        }
      }
    }

    if (strength > 0 && regime !== 'continuous' && creepRow.creepMaxTensile >= strength) {
      exceedanceHoursAfterRelief.push(row.hour);
    }

    warnings.push(...solved.hourWarnings);
    hourlyResults.push(solved.result);
    creepResults.push(creepRow);
  }

  if (exceedanceHoursAfterRelief.length > 0) {
    warnings.push(
      `Tensile demand still reaches the strength at ${exceedanceHoursAfterRelief.length} hour(s) ` +
      `after the joint/crack relieved the slab (first: hour ${exceedanceHoursAfterRelief[0]}); ` +
      `expect additional cracking. The model forms one crack and does not subdivide the panel further.`,
    );
  }

  // -------------------------------------------------------------------------
  // Step 4: Saw-cut timing verdict
  // -------------------------------------------------------------------------

  // Was there a pre-cut window to assess at all? Read this from the saw-cut
  // input, not from the emitted regimes: a crack on the very first hour rewrites
  // that row to 'cracked', which would otherwise look like "never continuous".
  const hasPreCutWindow =
    sawCutHour !== undefined && hourlyInputs.some(r => r.hour < sawCutHour);

  // `preCutPeakRatio` is set exactly when at least one continuous hour had a
  // capacity to check against, so it doubles as "the check actually ran". A
  // strength history that only covers post-cut hours cannot clear the saw-cut.
  let verdict: SawCutVerdict;
  if (!hasPreCutWindow)                    verdict = 'jointedThroughout';
  else if (naturalCrackHour !== undefined) verdict = 'crackedBeforeSawCut';
  else if (preCutPeakRatio === undefined)  verdict = 'noStrengthData';
  else                                     verdict = 'ok';

  const cracking: CrackingAssessment = {
    verdict,
    exceedanceHoursAfterRelief,
    ...(sawCutHour !== undefined         ? { sawCutHour } : {}),
    ...(naturalCrackHour !== undefined   ? { naturalCrackHour, crackDemand, crackStrength } : {}),
    ...(preCutPeakRatio !== undefined    ? { preCutPeakRatio, preCutPeakRatioHour } : {}),
  };

  return { hourlyResults, creepResults, cracking, warnings };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zeroResult(
  hour: number,
  E: number,
  regime: SlabRegime,
  pseudoUniformTemp = 0,
  pseudoGradientTemp = 0,
): HourlyStressResult {
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
    stressTop:                 0,
    stressBottom:              0,
    maxTensileStress:          0,
    pseudoUniformTemp,
    pseudoGradientTemp,
    edgeBendingFactor:         0,
    solverOk:                  true,
    regime,
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

