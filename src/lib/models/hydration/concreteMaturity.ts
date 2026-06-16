/**
 * Concrete Maturity & Hydration Model
 *
 * Implements the exponential hydration model (Schindler & Folliard style)
 * with cement-system-specific coefficients, equivalent age maturity,
 * heat of hydration, elastic modulus lookup, and KIC-based stress intensity.
 *
 * Cement systems supported:
 *   Type I/II, Type I/II w/ 5% Limestone, PLC,
 *   25% C Ash, 25% F Ash, 25% GGBFS, Custom
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CementType = 'Type I/II' | 'Type I/II w/ 5% Limestone' | 'PLC';
export type SCMType = 'None' | '25% C Ash' | '25% F Ash' | '25% GGBFS' | 'Custom';

/** Resolved label used internally for coefficient lookup */
export type CementSystemKey =
  | 'Type I/II'
  | '5% limestone'
  | '15% limestone'
  | '25% C ash'
  | '25% F ash'
  | '25% slag'
  | 'Custom';

export interface HydrationCoefficients {
  /** Slope & intercept for Cc (cement content factor) */
  Cc: { slope: number; intercept: number };
  /** Slope & intercept for alpha_u (ultimate degree of hydration) */
  alphaU: { slope: number; intercept: number };
  /** Slope & intercept for Beta (shape parameter) */
  Beta: { slope: number; intercept: number };
  /** Slope & intercept for Hu (ultimate heat of hydration, J/g) */
  Hu: { slope: number; intercept: number };
  /** Slope & intercept for tau (time parameter, hr) */
  tau: { slope: number; intercept: number };
  /** Quadratic coefficients for Ea (activation energy, J/mol): ax^2 + bx + c */
  Ea: { a: number; b: number; c: number };
}

/**
 * User-supplied compressive strength, converted to an age-appropriate tensile
 * strength via the degree of hydration and an ACI compressive→tensile equation
 * (f_t = tensileCoeff · √f'c, psi). When present and valid, this replaces the
 * KIC-based strength as the per-hour `strength` returned by `runModel`.
 */
export interface CompressiveStrengthConfig {
  /** 'fc28' = single 28-day strength; 'curve' = ≥3 (age, f'c) data points */
  mode: 'fc28' | 'curve';
  /** 28-day compressive strength in psi (mode 'fc28') */
  fc28Psi?: number;
  /** Development curve points (mode 'curve'); ages in days, f'c in psi */
  curve?: { ageDays: number; fcPsi: number }[];
  /** ACI coefficient C in f_t = C·√f'c (psi). e.g. 7.5 (MOR), 6.7 (splitting) */
  tensileCoeff: number;
}

export interface ProjectInputs {
  cementType: CementType;
  scmType: SCMType;
  /** Water-to-cementitious ratio (w/cm) */
  wcm: number;
  /** Curing temperature in °F (converted internally to °C) */
  curingTempF: number;
  /** Sawcut depth in meters (AN1 in the spreadsheet) */
  sawcutDepth: number;
  /** Reference temperature Tr in °C (default 23) */
  Tr?: number;
  /** Custom coefficients – required when scmType is 'Custom' */
  customCoefficients?: HydrationCoefficients;
  /** Optional user compressive-strength input (drives tensile strength) */
  compressive?: CompressiveStrengthConfig;
}

export interface HourlyResult {
  hour: number;
  equivalentAge: number;
  degreeOfHydration: number;
  heatOfHydration: number;
  /** Elastic modulus in psi (from lookup, 0 if unavailable) */
  elasticModulus: number;
  /**
   * Concrete strength in psi. When a compressive-strength config is supplied
   * this is the ACI tensile strength derived from the age-appropriate
   * compressive strength; otherwise it is the KIC-based strength.
   */
  strength: number;
  /**
   * Age-appropriate compressive strength in psi (only populated when a
   * compressive-strength config is supplied; undefined otherwise).
   */
  compressiveStrength?: number;
}

// ---------------------------------------------------------------------------
// Coefficient tables (from spreadsheet rows 5–11, columns T–AF)
// ---------------------------------------------------------------------------

const COEFFICIENTS: Record<CementSystemKey, HydrationCoefficients> = {
  'Type I/II': {
    Cc:     { slope: -468779.695671, intercept: 534506.710124 },
    alphaU: { slope: 47.666667, intercept: 72.067778 },
    Beta:   { slope: -0.469167, intercept: 0.755203 },
    Hu:     { slope: 247.05, intercept: 404.096167 },
    tau:    { slope: 29.638355, intercept: -3.387958 },
    Ea:     { a: -972943.722944, b: 764647.186147, c: -103860.432900 },
  },
  '5% limestone': {
    Cc:     { slope: -466086.196246, intercept: 532420.443523 },
    alphaU: { slope: 45.15, intercept: 66.4385 },
    Beta:   { slope: -0.604, intercept: 0.815873 },
    Hu:     { slope: 247.266667, intercept: 428.598444 },
    tau:    { slope: 21.475503, intercept: -1.668081 },
    Ea:     { a: -386363.636364, b: 325651.515152, c: -17578.484848 },
  },
  '15% limestone': {
    Cc:     { slope: -461473.340857, intercept: 528835.110017 },
    alphaU: { slope: 40.416667, intercept: 60.980278 },
    Beta:   { slope: -0.653, intercept: 0.829719 },
    Hu:     { slope: 247.533333, intercept: 486.341333 },
    tau:    { slope: 19.302807, intercept: -0.167225 },
    Ea:     { a: 996753.246753, b: -774837.662338, c: 198498.051948 },
  },
  '25% C ash': {
    Cc:     { slope: -448696.725534, intercept: 518860.768766 },
    alphaU: { slope: 35.266667, intercept: 68.559556 },
    Beta:   { slope: -0.7415, intercept: 1.090104 },
    Hu:     { slope: 247.716667, intercept: 268.616167 },
    tau:    { slope: 8.255476, intercept: -0.203751 },
    Ea:     { a: -3246.753247, b: 4162.337662, c: 45608.051948 },
  },
  '25% F ash': {
    Cc:     { slope: -441694.989253, intercept: 513366.098621 },
    alphaU: { slope: 35.333333, intercept: 68.531111 },
    Beta:   { slope: -0.619333, intercept: 0.970938 },
    Hu:     { slope: 247.7, intercept: 337.434111 },
    tau:    { slope: 11.003252, intercept: -0.396932 },
    Ea:     { a: -374458.874459, b: 301056.277056, c: -14214.675325 },
  },
  '25% slag': {
    Cc:     { slope: -462082.591277, intercept: 529308.924439 },
    alphaU: { slope: 35.766667, intercept: 71.526778 },
    Beta:   { slope: -0.563667, intercept: 0.865614 },
    Hu:     { slope: 251.983333, intercept: 408.182389 },
    tau:    { slope: 16.030311, intercept: -0.137944 },
    Ea:     { a: -29220.779221, b: 24461.038961, c: 37835.800866 },
  },
  Custom: {
    Cc:     { slope: 0, intercept: 0 },
    alphaU: { slope: 0, intercept: 0 },
    Beta:   { slope: 0, intercept: 0 },
    Hu:     { slope: 0, intercept: 0 },
    tau:    { slope: 0, intercept: 0 },
    Ea:     { a: 0, b: 0, c: 0 },
  },
};

// ---------------------------------------------------------------------------
// Curing temperature → set time lookup (spreadsheet rows 29–35)
// Columns: Temp(°C), then set-time hours per system
// ---------------------------------------------------------------------------

interface CuringRow {
  tempC: number;
  setTimes: Record<Exclude<CementSystemKey, 'Custom'>, number>;
}

const CURING_TABLE: CuringRow[] = [
  { tempC: 5,  setTimes: { 'Type I/II': 9, '5% limestone': 10, '15% limestone': 10, '25% C ash': 9, '25% F ash': 9, '25% slag': 8 } },
  { tempC: 10, setTimes: { 'Type I/II': 9, '5% limestone': 10, '15% limestone': 10, '25% C ash': 8, '25% F ash': 9, '25% slag': 8 } },
  { tempC: 15, setTimes: { 'Type I/II': 8, '5% limestone': 10, '15% limestone': 10, '25% C ash': 8, '25% F ash': 8, '25% slag': 8 } },
  { tempC: 20, setTimes: { 'Type I/II': 7, '5% limestone': 7,  '15% limestone': 8,  '25% C ash': 7, '25% F ash': 8, '25% slag': 8 } },
  { tempC: 25, setTimes: { 'Type I/II': 6, '5% limestone': 6,  '15% limestone': 6,  '25% C ash': 6, '25% F ash': 6, '25% slag': 6 } },
  { tempC: 30, setTimes: { 'Type I/II': 6, '5% limestone': 6,  '15% limestone': 6,  '25% C ash': 6, '25% F ash': 6, '25% slag': 6 } },
  { tempC: 35, setTimes: { 'Type I/II': 6, '5% limestone': 5,  '15% limestone': 6,  '25% C ash': 6, '25% F ash': 6, '25% slag': 6 } },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map user-facing cement/SCM selections to the internal coefficient key */
export function resolveCementSystem(cementType: CementType, scmType: SCMType): CementSystemKey {
  if (scmType !== 'None') {
    const map: Record<Exclude<SCMType, 'None'>, CementSystemKey> = {
      '25% C Ash': '25% C ash',
      '25% F Ash': '25% F ash',
      '25% GGBFS': '25% slag',
      Custom: 'Custom',
    };
    return map[scmType];
  }
  const map: Record<CementType, CementSystemKey> = {
    'Type I/II': 'Type I/II',
    'Type I/II w/ 5% Limestone': '5% limestone',
    PLC: '15% limestone',
  };
  return map[cementType];
}

/** Find nearest curing temperature in the table (XMATCH/MIN/ABS logic) */
export function findNearestCuringTempC(targetC: number): number {
  const temps = CURING_TABLE.map((r) => r.tempC);
  let minDiff = Infinity;
  let best = temps[0];
  for (const t of temps) {
    const diff = Math.abs(t - targetC);
    if (diff < minDiff) {
      minDiff = diff;
      best = t;
    }
  }
  return best;
}

/** Look up set time (hours) from the curing table */
export function getSetTimeHours(systemKey: CementSystemKey, curingTempC: number): number {
  if (systemKey === 'Custom') return 6; // default fallback
  const nearestC = findNearestCuringTempC(curingTempC);
  const row = CURING_TABLE.find((r) => r.tempC === nearestC)!;
  return row.setTimes[systemKey];
}

// ---------------------------------------------------------------------------
// Resolved parameters from w/cm
// ---------------------------------------------------------------------------

export interface ResolvedParams {
  Cc: number;       // g/m³
  Ea: number;       // J/mol
  alphaU: number;   // fraction (0–1)
  Beta: number;     // dimensionless
  Hu: number;       // J/g
  tau: number;      // hours
  R: number;        // gas constant J/mol·K
  Tr: number;       // reference temp °C
  Tc: number;       // curing temp °C (nearest table value)
}

export function resolveParams(inputs: ProjectInputs): ResolvedParams {
  const systemKey = resolveCementSystem(inputs.cementType, inputs.scmType);

  let coeff: HydrationCoefficients;
  if (systemKey === 'Custom') {
    if (!inputs.customCoefficients) {
      throw new Error('customCoefficients required when scmType is Custom');
    }
    coeff = inputs.customCoefficients;
  } else {
    coeff = COEFFICIENTS[systemKey];
  }

  const w = inputs.wcm;
  const curingC = (inputs.curingTempF - 32) * (5 / 9);
  const Tc = findNearestCuringTempC(curingC);

  return {
    Cc:     coeff.Cc.slope * w + coeff.Cc.intercept,
    Ea:     coeff.Ea.a * w * w + coeff.Ea.b * w + coeff.Ea.c,
    alphaU: (coeff.alphaU.slope * w + coeff.alphaU.intercept) / 100,
    Beta:   coeff.Beta.slope * w + coeff.Beta.intercept,
    Hu:     coeff.Hu.slope * w + coeff.Hu.intercept,
    tau:    coeff.tau.slope * w + coeff.tau.intercept,
    R:      8.314,
    Tr:     inputs.Tr ?? 23,
    Tc,
  };
}

// ---------------------------------------------------------------------------
// Core computation: equivalent age, hydration, heat, KIC
// ---------------------------------------------------------------------------

/**
 * Compute equivalent age increment for one hour.
 * te(1hr) = exp((-Ea/R) * (1/(Tc+273) - 1/(Tr+273)))
 */
export function equivalentAgeIncrement(p: ResolvedParams): number {
  return Math.exp((-p.Ea / p.R) * (1 / (p.Tc + 273) - 1 / (p.Tr + 273)));
}

/** Degree of hydration: alpha = alphaU * exp(-(tau/te)^Beta) */
export function degreeOfHydration(alphaU: number, tau: number, Beta: number, te: number): number {
  if (te <= 0) return 0;
  return alphaU * Math.exp(-Math.pow(tau / te, Beta));
}

/**
 * Heat of hydration rate (J/g/hr at reference temperature):
 * q = Hu * Cc * (tau/te)^Beta * (Beta/te) * alpha * exp(Ea/R * (1/(Tr+273) - 1/(Tc+273)))
 */
export function heatOfHydration(
  p: ResolvedParams,
  te: number,
  alpha: number,
): number {
  if (te <= 0) return 0;
  const tauOverTe = p.tau / te;
  const arrhenius = Math.exp((p.Ea / p.R) * (1 / (p.Tr + 273) - 1 / (p.Tc + 273)));
  return p.Hu * p.Cc * Math.pow(tauOverTe, p.Beta) * (p.Beta / te) * alpha * arrhenius;
}

/**
 * KIC-based stress intensity factor → strength (psi).
 *
 * KIC = (-0.3448*w/cm + 1.0375) - ((-75.86*w/cm + 44.323)*(hour/24))
 *       / ((1 - 0.1281*(hour/24))^(1/(-0.1371*w/cm + 0.0327)))
 *
 * Strength (psi) = KIC / (sqrt(pi * depth * 1/3 * 0.0254)
 *   * (0.265*(1-1/3)^4 + (0.857+0.265*1/3)/((1-1/3)^1.5))) * 145.038
 *
 * where depth comes from project data and the 1/3 ratio is fixed (AN2).
 */
export function computeKIC(wcm: number, hour: number): number {
  const dayFrac = hour / 24;
  const exponent = 1 / (-0.1371 * wcm + 0.0327);
  const denom = Math.pow(1 - 0.1281 * dayFrac, exponent);
  const numerator = (-75.86 * wcm + 44.323) * dayFrac;
  return (-0.3448 * wcm + 1.0375) - numerator / denom;
}

export function kicToStrength(kic: number, sawcutDepth: number, ratio = 1 / 3): number {
  const depthM = sawcutDepth * ratio * 0.0254; // convert to meters
  const sqrtTerm = Math.sqrt(Math.PI * depthM);
  const shapeFactor =
    0.265 * Math.pow(1 - ratio, 4) +
    (0.857 + 0.265 * ratio) / Math.pow(1 - ratio, 1.5);
  return (kic / (sqrtTerm * shapeFactor)) * 145.038;
}

// ---------------------------------------------------------------------------
// Compressive → age-appropriate tensile strength
//
// User supplies compressive strength (a single 28-day value or a development
// curve). The degree of hydration maps it to an age-appropriate compressive
// strength, which is then converted to tensile via the ACI relationship
// f_t = C · √f'c (psi), with C user-selectable (7.5 MOR, 6.7 splitting, …).
// ---------------------------------------------------------------------------

/** Number of hours in 28 days, used as the reference age for f'c,28. */
export const HOURS_28_DAY = 28 * 24;

/** ACI compressive→tensile conversion: f_t = coeff · √f'c (psi). */
export function compressiveToTensile(fcPsi: number, coeff: number): number {
  if (!(fcPsi > 0) || !(coeff > 0)) return 0;
  return coeff * Math.sqrt(fcPsi);
}

/**
 * Scale a 28-day compressive strength to the strength at degree of hydration
 * alphaT using the critical (set) degree of hydration alpha0 as the origin:
 *
 *   f'c(t) = f'c,28 · (alphaT − alpha0) / (alpha28 − alpha0)
 *
 * Returns 0 for alphaT ≤ alpha0 (no strength before set). Guards against a
 * degenerate (alpha28 ≤ alpha0) denominator.
 */
export function scaledCompressive28(
  fc28: number,
  alphaT: number,
  alpha0: number,
  alpha28: number,
): number {
  if (!(fc28 > 0)) return 0;
  const denom = alpha28 - alpha0;
  if (!(denom > 0)) return 0;
  const frac = (alphaT - alpha0) / denom;
  return frac > 0 ? fc28 * frac : 0;
}

/**
 * Interpolate compressive strength from a development curve in degree-of-
 * hydration space. `pts` are (alpha, fcPsi) pairs sorted by ascending alpha,
 * each curve age having been mapped to its degree of hydration. A synthetic
 * (alpha0, 0) origin is prepended so strength ramps from zero at set.
 *
 * Clamps: alphaT ≤ alpha0 → 0; alphaT ≥ last alpha → hold the last f'c.
 */
export function interpolateCompressiveCurve(
  pts: { alpha: number; fcPsi: number }[],
  alpha0: number,
  alphaT: number,
): number {
  if (alphaT <= alpha0) return 0;
  // (alpha0, 0) origin + provided points with alpha above set, sorted ascending.
  const anchored = [{ alpha: alpha0, fcPsi: 0 }, ...pts.filter((p) => p.alpha > alpha0)]
    .sort((a, b) => a.alpha - b.alpha);
  if (anchored.length === 1) return 0; // no usable data points above set
  const last = anchored[anchored.length - 1];
  if (alphaT >= last.alpha) return Math.max(0, last.fcPsi);
  for (let i = 1; i < anchored.length; i++) {
    const lo = anchored[i - 1];
    const hi = anchored[i];
    if (alphaT <= hi.alpha) {
      const span = hi.alpha - lo.alpha;
      if (span <= 0) return Math.max(0, hi.fcPsi);
      const frac = (alphaT - lo.alpha) / span;
      return Math.max(0, lo.fcPsi + frac * (hi.fcPsi - lo.fcPsi));
    }
  }
  return Math.max(0, last.fcPsi);
}

/**
 * Validate a compressive-strength config and normalise it into the data needed
 * by `runModel`. Returns null when the config cannot produce a usable strength
 * (caller should then fall back to the KIC strength).
 */
function resolveCompressive(
  cfg: CompressiveStrengthConfig | undefined,
): { mode: 'fc28'; fc28: number; coeff: number }
  | { mode: 'curve'; curve: { ageDays: number; fcPsi: number }[]; coeff: number }
  | null {
  if (!cfg) return null;
  const coeff = cfg.tensileCoeff;
  if (!(coeff > 0)) return null;
  if (cfg.mode === 'fc28') {
    if (!(typeof cfg.fc28Psi === 'number' && cfg.fc28Psi > 0)) return null;
    return { mode: 'fc28', fc28: cfg.fc28Psi, coeff };
  }
  const curve = (cfg.curve ?? []).filter(
    (p) => typeof p.ageDays === 'number' && p.ageDays > 0 && typeof p.fcPsi === 'number' && p.fcPsi > 0,
  );
  if (curve.length < 3) return null;
  return { mode: 'curve', curve, coeff };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run the maturity model for 0..maxHours and return hourly results.
 * Elastic modulus is set to 0 (requires external lookup table not in this sheet).
 */
export function runModel(inputs: ProjectInputs, maxHours = 72): HourlyResult[] {
  const p = resolveParams(inputs);
  const teIncrement = equivalentAgeIncrement(p);
  const setTimeHours = getProjectSetTime(inputs);
  const results: HourlyResult[] = [];

  // ── Compressive → tensile strength setup (when a valid config is supplied) ──
  const comp = resolveCompressive(inputs.compressive);
  // Degree of hydration at set time (critical α₀) and at 28 days (reference).
  const alpha0 = degreeOfHydration(p.alphaU, p.tau, p.Beta, setTimeHours * teIncrement);
  const alpha28 = degreeOfHydration(p.alphaU, p.tau, p.Beta, HOURS_28_DAY * teIncrement);
  // For curve mode, map each (age, f'c) point onto degree-of-hydration space.
  const curveAlpha =
    comp?.mode === 'curve'
      ? comp.curve.map((pt) => ({
          alpha: degreeOfHydration(p.alphaU, p.tau, p.Beta, pt.ageDays * 24 * teIncrement),
          fcPsi: pt.fcPsi,
        }))
      : [];

  /** Per-hour compressive/tensile from the user config; null if not applicable. */
  function compressiveAt(alpha: number): { compressive: number; tensile: number } | null {
    if (!comp) return null;
    const fc =
      comp.mode === 'fc28'
        ? scaledCompressive28(comp.fc28, alpha, alpha0, alpha28)
        : interpolateCompressiveCurve(curveAlpha, alpha0, alpha);
    return { compressive: fc, tensile: compressiveToTensile(fc, comp.coeff) };
  }

  // Hour 0
  results.push({
    hour: 0,
    equivalentAge: 0,
    degreeOfHydration: 0,
    heatOfHydration: 0,
    elasticModulus: 0,
    strength: 0,
    ...(comp ? { compressiveStrength: 0 } : {}),
  });

  let cumulativeTe = 0;

  for (let h = 1; h <= maxHours; h++) {
    // Equivalent age accumulates: te(h) = te(h-1) + increment
    cumulativeTe += teIncrement;

    const alpha = degreeOfHydration(p.alphaU, p.tau, p.Beta, cumulativeTe);
    const heat = heatOfHydration(p, cumulativeTe, alpha);

    // Strength: ACI tensile from user compressive input when supplied,
    // otherwise KIC-based. Both are zero until the concrete reaches set time.
    let strength = 0;
    let compressiveStrength: number | undefined;
    if (h >= setTimeHours) {
      if (comp) {
        const s = compressiveAt(alpha)!;
        compressiveStrength = s.compressive;
        strength = s.tensile;
      } else if (inputs.sawcutDepth > 0) {
        const kic = computeKIC(inputs.wcm, h);
        const raw = kicToStrength(kic, inputs.sawcutDepth);
        strength = raw > 0 ? raw : 0;
      }
    } else if (comp) {
      compressiveStrength = 0;
    }

    results.push({
      hour: h,
      equivalentAge: cumulativeTe,
      degreeOfHydration: alpha,
      heatOfHydration: heat,
      elasticModulus: 0, // requires ModulusEstimate sheet not present
      strength,
      ...(comp ? { compressiveStrength: compressiveStrength ?? 0 } : {}),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Convenience: get set time for a project
// ---------------------------------------------------------------------------

export function getProjectSetTime(inputs: ProjectInputs): number {
  const systemKey = resolveCementSystem(inputs.cementType, inputs.scmType);
  const curingC = (inputs.curingTempF - 32) * (5 / 9);
  return getSetTimeHours(systemKey, curingC);
}
