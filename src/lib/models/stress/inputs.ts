/**
 * Builds a StressModelInput from the upstream model outputs available in the
 * app stores, decoupled from Svelte so it can be unit-tested directly.
 *
 * Data sources
 * ------------
 *   • Elastic modulus E(t):  E_mature · α(t)/α_u   (degree-of-hydration scaling)
 *       - α(t)  : per-hour degree of hydration from the concrete-maturity model
 *       - α_u   : ultimate degree of hydration (Schindler-Folliard result, or
 *                 a literature fallback)
 *       - E_mature : user-supplied 28-day / fully-hydrated modulus (psi)
 *     The ratio is clamped to [0, 1] so E never exceeds E_mature.
 *
 *   • Uniform ΔT_c(t) and gradient ΔT_g(t):  from the illitherm thermal model.
 *       Both are measured as the CHANGE from the set-time (stress-free)
 *       temperature state:
 *         ΔT_c(t) = mean(temps_t)        − mean(temps_set)        [°F]
 *         ΔT_g(t) = (top_t − bottom_t)   − (top_set − bottom_set) [°F]
 *       illitherm stores temperatures in °C, so differences are scaled by 1.8.
 *       temps[0] is the slab surface (top); temps[last] is the bottom.
 *
 * The set time (startHour) is the loading age at which the creep clock starts.
 */

import type {
  StressModelInput,
  CreepModelParams,
  HourlyInput,
} from './types';

/** A maturity row — only the fields the builder needs. */
export interface MaturityRowLike {
  hour: number;
  degreeOfHydration: number;
}

/** A thermal-profile row — results[i] corresponds to absolute hour i + 1. */
export interface ThermalRowLike {
  temps: number[];
}

export interface BuildStressInputArgs {
  /** Set time (h) — first analysed hour and creep loading-age origin. */
  startHour: number;
  /** Last analysed hour (default 72, clamped to available thermal data). */
  endHour?: number;
  slab: {
    /** Slab thickness (in) */
    thicknessIn: number;
    /** Joint spacing (ft) */
    jointSpacingFt: number;
    /** Poisson's ratio */
    poissonRatio: number;
    /** Coefficient of thermal expansion (1/°F) */
    coteF: number;
    /** Modulus of subgrade reaction (psi/in) */
    kValue: number;
    /** Horizontal slab-base restraint coefficient (psi/in) */
    frictionCoefficient: number;
  };
  /** Fully-hydrated / 28-day elastic modulus (psi). */
  matureModulusPsi: number;
  /** Ultimate degree of hydration α_u used to normalise α(t). */
  alphaUltimate: number;
  /** Normalised sawcut depth α = a/h (dimensionless, optional). */
  sawcutNormalized?: number;
  /**
   * Hour index (1 = placement) at which the saw-cut joint is created. Before
   * this hour the slab is modelled as continuous (infinite); at/after it the
   * transverse joint is active. Omit to model the joint as present throughout.
   */
  sawCutHour?: number;
  /** Maturity rows covering hours 0..endHour (degree of hydration per hour). */
  maturity: MaturityRowLike[];
  /** Thermal rows; results[i] is hour i + 1 (temps in °C, index 0 = top). */
  thermal: ThermalRowLike[];
  /** Creep parameter overrides. */
  creep?: Partial<CreepModelParams>;
}

export interface BuildStressInputResult {
  /** Ready-to-run model input, or null when blocking issues exist. */
  input: StressModelInput | null;
  /** Blocking problems that prevented building a valid input. */
  issues: string[];
  /** Non-blocking, informational notes about assumptions made. */
  notes: string[];
}

const C_TO_F_DELTA = 1.8;

/**
 * Minimum loading age (h) for the creep model. The bounded aging-modulus models
 * (hydration / CEB-FIP / AEMM) stay positive for any tʹ > 0, so this is no
 * longer the old ~4.6 h negative-modulus limit — it is just a sanity floor that
 * keeps the loading age clear of tʹ → 0, where every model's stiffness collapses
 * toward zero and the compliance becomes ill-conditioned.
 */
const MIN_CREEP_START_HOUR = 1;

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

/** top − bottom for a through-depth temperature profile (index 0 = top). */
function topMinusBottom(temps: number[]): number {
  if (temps.length < 2) return 0;
  return temps[0] - temps[temps.length - 1];
}

/**
 * Build a StressModelInput from upstream maturity + thermal results.
 * Returns `{ input: null, issues }` when required data is missing.
 */
export function buildStressInput(args: BuildStressInputArgs): BuildStressInputResult {
  const issues: string[] = [];
  const notes: string[] = [];

  const { slab } = args;
  const startHour = Math.round(args.startHour);

  // --- Validate scalar inputs ----------------------------------------------
  if (!Number.isFinite(startHour) || startHour < 1) {
    issues.push('A valid set time (start hour ≥ 1) is required.');
  }
  if (startHour < MIN_CREEP_START_HOUR) {
    issues.push(
      `Set time is ${startHour} h; the creep model needs a loading age ≥ ${MIN_CREEP_START_HOUR} h ` +
        `(the aging modulus collapses toward zero as the loading age → 0).`,
    );
  }
  if (!(slab.thicknessIn > 0)) issues.push('Slab thickness must be set (Slab Layout tab).');
  if (!(slab.jointSpacingFt > 0)) issues.push('Joint spacing must be set (Slab Layout tab).');
  if (!(slab.kValue > 0)) issues.push('Modulus of subgrade reaction (k) must be positive.');
  if (!(slab.frictionCoefficient >= 0)) issues.push('Friction coefficient must be ≥ 0.');
  if (!(slab.coteF > 0)) issues.push('Coefficient of thermal expansion must be positive.');
  if (slab.poissonRatio < 0 || slab.poissonRatio >= 0.5) {
    issues.push("Poisson's ratio must be in [0, 0.5).");
  }
  if (!(args.matureModulusPsi > 0)) issues.push('Mature elastic modulus must be positive.');
  if (!(args.alphaUltimate > 0)) {
    issues.push('Ultimate degree of hydration (α_u) must be positive — run the hydration model.');
  }
  if (!args.maturity?.length) {
    issues.push('Run the concrete-maturity model (Materials tab) to provide degree-of-hydration data.');
  }
  if (!args.thermal?.length) {
    issues.push('Run the temperature-gradient model (Results tab) to provide thermal profiles.');
  }

  // Sawcut depth: a numeric 0 (or negative) means "no sawcut" — a free joint —
  // not an error. computeJointCoefficients only accepts (0, 0.7], so validate
  // here and translate out-of-range values into a clean issue/note instead of
  // letting it throw a raw RangeError downstream.
  let effectiveSawcut: number | undefined;
  if (args.sawcutNormalized !== undefined) {
    const s = args.sawcutNormalized;
    if (!Number.isFinite(s) || s <= 0) {
      notes.push('Sawcut depth α ≤ 0 — modelled as a free (open) joint.');
    } else if (s > 0.7) {
      issues.push(`Sawcut depth α = ${s} is out of range; must be between 0 and 0.7.`);
    } else {
      effectiveSawcut = s;
    }
  }

  if (issues.length) return { input: null, issues, notes };

  // --- Resolve analysis window against available thermal data --------------
  // thermal[i] is hour i + 1, so hour H lives at index H − 1.
  const maxThermalHour = args.thermal.length; // results[len-1] → hour len
  // Maturity (degree-of-hydration) horizon — independent model, may be shorter.
  const maxMaturityHour = args.maturity.reduce(
    (mx, r) => Math.max(mx, Math.round(r.hour)),
    0,
  );
  let endHour = args.endHour ?? 72;
  if (endHour > maxThermalHour) {
    notes.push(`Analysis window clamped to ${maxThermalHour} h (thermal data length).`);
    endHour = maxThermalHour;
  }
  if (endHour > maxMaturityHour) {
    notes.push(`Analysis window clamped to ${maxMaturityHour} h (degree-of-hydration data length).`);
    endHour = maxMaturityHour;
  }
  if (endHour <= startHour) {
    issues.push(`End hour (${endHour}) must be greater than the set time (${startHour}).`);
    return { input: null, issues, notes };
  }

  // --- Saw-cut timing: when the transverse joint is created ----------------
  // Before this hour the slab is continuous (infinite) and fully restrained;
  // at/after it the joint relieves stress. Out-of-window values are kept (the
  // model handles them) but noted, since they collapse to a single regime.
  let effectiveSawCutHour: number | undefined;
  if (args.sawCutHour !== undefined && Number.isFinite(args.sawCutHour) && args.sawCutHour >= 1) {
    effectiveSawCutHour = Math.round(args.sawCutHour);
    if (effectiveSawCutHour <= startHour) {
      notes.push(
        `Saw-cut (hour ${effectiveSawCutHour}) falls at/before the set time; the joint is modelled as active for the whole analysis window.`,
      );
    } else if (effectiveSawCutHour > endHour) {
      notes.push(
        `Saw-cut (hour ${effectiveSawCutHour}) falls after the analysis window; the slab is modelled as continuous (infinite) throughout.`,
      );
    } else {
      notes.push(
        `Slab modelled as continuous (infinite) until the saw-cut at hour ${effectiveSawCutHour}; jointed thereafter.`,
      );
    }
  } else {
    notes.push(
      'No saw-cut time supplied; the transverse joint is modelled as present for the whole window.',
    );
  }

  // --- Reference (set-time, stress-free) temperature state -----------------
  const refRow = args.thermal[startHour - 1];
  if (!refRow || !refRow.temps?.length) {
    issues.push(`No thermal profile available at the set time (hour ${startHour}).`);
    return { input: null, issues, notes };
  }
  const refMeanC = mean(refRow.temps);
  const refGradC = topMinusBottom(refRow.temps);

  // --- Degree-of-hydration lookup by absolute hour -------------------------
  const alphaByHour = new Map<number, number>();
  for (const r of args.maturity) alphaByHour.set(Math.round(r.hour), r.degreeOfHydration);

  // --- Assemble hourly inputs ----------------------------------------------
  const hourlyInputs: HourlyInput[] = [];
  let clampedModulusHours = 0;

  for (let hour = startHour; hour <= endHour; hour++) {
    const thermalRow = args.thermal[hour - 1];
    if (!thermalRow || !thermalRow.temps?.length) {
      issues.push(`Missing thermal profile at hour ${hour}.`);
      return { input: null, issues, notes };
    }

    if (!alphaByHour.has(hour)) {
      issues.push(
        `Missing degree-of-hydration data at hour ${hour}; run the concrete-maturity model over the full window.`,
      );
      return { input: null, issues, notes };
    }
    const alpha = alphaByHour.get(hour)!;
    let ratio = alpha / args.alphaUltimate;
    if (ratio > 1) { ratio = 1; clampedModulusHours++; }
    if (ratio < 0) ratio = 0;
    const elasticModulus = args.matureModulusPsi * ratio;

    const meanC = mean(thermalRow.temps);
    const gradC = topMinusBottom(thermalRow.temps);

    hourlyInputs.push({
      hour,
      elasticModulus,
      uniformTempChange:  (meanC - refMeanC) * C_TO_F_DELTA,
      gradientTempChange: (gradC - refGradC) * C_TO_F_DELTA,
    });
  }

  if (clampedModulusHours > 0) {
    notes.push(
      `${clampedModulusHours} hour(s) had α(t) ≥ α_u; modulus clamped to the mature value.`,
    );
  }

  const input: StressModelInput = {
    startHour,
    endHour,
    slab: {
      thickness:           slab.thicknessIn,
      poissonRatio:        slab.poissonRatio,
      cote:                slab.coteF,
      kValue:              slab.kValue,
      jointSpacingFt:      slab.jointSpacingFt,
      frictionCoefficient: slab.frictionCoefficient,
    },
    hourlyInputs,
    ...(effectiveSawcut !== undefined ? { sawcutNormalized: effectiveSawcut } : {}),
    ...(effectiveSawCutHour !== undefined ? { sawCutHour: effectiveSawCutHour } : {}),
    ...(args.creep ? { creep: args.creep } : {}),
  };

  return { input, issues, notes };
}
