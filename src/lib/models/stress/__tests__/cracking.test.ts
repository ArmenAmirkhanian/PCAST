/**
 * Tests for the natural-cracking check: the slab must stop behaving like an
 * infinite (continuous) panel once the creep-adjusted tensile demand reaches the
 * tensile strength before the saw-cut, and the run must report whether the
 * proposed saw-cut time beats that crack.
 */

import { describe, it, expect } from 'vitest';
import { runStressModel } from '../run';
import { buildStressInput, type BuildStressInputArgs } from '../inputs';
import type { StressModelInput, HourlyInput } from '../types';

const START = 10;
const END = 20;
const SAW_CUT = 18;

/**
 * A cooling history that ramps the demand hour by hour so the crack hour moves
 * with the supplied strength. Constant modulus keeps every hour "active" (no
 * zero rows that would mask the regime).
 */
function hourlyInputs(strength: number | undefined): HourlyInput[] {
  return Array.from({ length: END - START + 1 }, (_, i) => ({
    hour: START + i,
    elasticModulus: 3_000_000,
    uniformTempChange: -10 - i,
    gradientTempChange: -20 - i,
    ...(strength === undefined ? {} : { tensileStrength: strength }),
  }));
}

function model(strength: number | undefined, extra: Partial<StressModelInput> = {}): StressModelInput {
  return {
    startHour: START,
    endHour: END,
    slab: {
      thickness: 9,
      poissonRatio: 0.15,
      cote: 5e-6,
      kValue: 100,
      jointSpacingFt: 15,
      frictionCoefficient: 1,
    },
    sawcutNormalized: 0.25,
    sawCutHour: SAW_CUT,
    hourlyInputs: hourlyInputs(strength),
    ...extra,
  };
}

// Demands for this fixture run ~300 psi at hour 10 up to ~460 psi at hour 17
// (continuous regime), so 200 psi cracks immediately, 400 psi cracks mid-window
// and 5000 psi never cracks.
const CRACKS_EARLY = 200;
const CRACKS_MIDWAY = 400;
const NEVER_CRACKS = 5000;

// ---------------------------------------------------------------------------
// No strength data → legacy behaviour, check disabled
// ---------------------------------------------------------------------------

describe('natural cracking – without strength data', () => {
  it('reports verdict noStrengthData and never cracks', () => {
    const out = runStressModel(model(undefined));
    expect(out.cracking.verdict).toBe('noStrengthData');
    expect(out.cracking.naturalCrackHour).toBeUndefined();
    expect(out.hourlyResults.every((r) => r.regime !== 'cracked')).toBe(true);
  });

  it('keeps the pre-cut continuous / post-cut jointed regimes', () => {
    const out = runStressModel(model(undefined));
    for (const r of out.hourlyResults) {
      expect(r.regime).toBe(r.hour < SAW_CUT ? 'continuous' : 'jointed');
    }
  });

  it('a zero strength is treated as "unknown", not as an instant crack', () => {
    const out = runStressModel(model(0));
    expect(out.cracking.verdict).toBe('noStrengthData');
    expect(out.cracking.naturalCrackHour).toBeUndefined();
  });

  it('non-finite or negative strengths are ignored rather than cracking the slab', () => {
    for (const bad of [NaN, -50, Infinity]) {
      const out = runStressModel(model(bad));
      expect(out.cracking.naturalCrackHour).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Strong concrete → no crack, saw-cut timing is adequate
// ---------------------------------------------------------------------------

describe('natural cracking – strength never reached', () => {
  const out = runStressModel(model(NEVER_CRACKS));

  it('verdict is ok and no crack hour is reported', () => {
    expect(out.cracking.verdict).toBe('ok');
    expect(out.cracking.naturalCrackHour).toBeUndefined();
    expect(out.cracking.sawCutHour).toBe(SAW_CUT);
  });

  it('leaves the stress history identical to a run with no strength data', () => {
    // Nothing about supplying a capacity may change the mechanics until it is
    // actually reached.
    const bare = runStressModel(model(undefined));
    for (let i = 0; i < out.creepResults.length; i++) {
      expect(out.creepResults[i].creepMaxTensile).toBeCloseTo(
        bare.creepResults[i].creepMaxTensile,
        10,
      );
      expect(out.hourlyResults[i].normalStress).toBeCloseTo(bare.hourlyResults[i].normalStress, 10);
    }
  });

  it('reports the peak pre-cut demand/capacity ratio (< 1) and its hour', () => {
    const preCut = out.creepResults.filter((c) => c.hour < SAW_CUT);
    const worst = preCut.reduce((a, b) => (b.demandCapacityRatio > a.demandCapacityRatio ? b : a));
    expect(out.cracking.preCutPeakRatio).toBeCloseTo(worst.demandCapacityRatio, 10);
    expect(out.cracking.preCutPeakRatioHour).toBe(worst.hour);
    expect(out.cracking.preCutPeakRatio!).toBeLessThan(1);
  });

  it('per-hour ratio equals demand / capacity', () => {
    for (const c of out.creepResults) {
      expect(c.tensileStrength).toBe(NEVER_CRACKS);
      expect(c.demandCapacityRatio).toBeCloseTo(c.creepMaxTensile / NEVER_CRACKS, 12);
      expect(c.cracked).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Weak concrete → the slab breaks before the saw-cut
// ---------------------------------------------------------------------------

describe('natural cracking – strength reached before the saw-cut', () => {
  const out = runStressModel(model(CRACKS_MIDWAY));
  const crackHour = out.cracking.naturalCrackHour!;

  it('declares a crack before the saw-cut and calls the timing out', () => {
    expect(out.cracking.verdict).toBe('crackedBeforeSawCut');
    expect(crackHour).toBeGreaterThanOrEqual(START);
    expect(crackHour).toBeLessThan(SAW_CUT);
    expect(out.cracking.crackStrength).toBe(CRACKS_MIDWAY);
    expect(out.cracking.crackDemand!).toBeGreaterThanOrEqual(CRACKS_MIDWAY);
  });

  it('the slab stops being an infinite panel at the crack hour and stays cracked', () => {
    for (const r of out.hourlyResults) {
      expect(r.regime).toBe(r.hour < crackHour ? 'continuous' : 'cracked');
    }
    // The crack outranks the later saw-cut: nothing reverts to 'jointed'.
    expect(out.hourlyResults.some((r) => r.hour >= SAW_CUT)).toBe(true);
    expect(out.hourlyResults.filter((r) => r.hour >= SAW_CUT).every((r) => r.regime === 'cracked')).toBe(true);
  });

  it('breaking the slab relieves it: axial restraint collapses at the crack hour', () => {
    const bare = runStressModel(model(undefined)); // same hour, still continuous
    const cracked = out.hourlyResults.find((r) => r.hour === crackHour)!;
    const continuous = bare.hourlyResults.find((r) => r.hour === crackHour)!;
    expect(Math.abs(continuous.normalStress)).toBeGreaterThan(1);
    expect(Math.abs(cracked.normalStress)).toBeLessThan(Math.abs(continuous.normalStress));
    // …and the reported demand at that hour drops below the demand that broke it.
    const relieved = out.creepResults.find((c) => c.hour === crackHour)!;
    expect(relieved.creepMaxTensile).toBeLessThan(out.cracking.crackDemand!);
  });

  it('KI is zero once the crack is through the depth (no ligament left)', () => {
    for (const r of out.hourlyResults.filter((x) => x.hour >= crackHour)) {
      expect(r.stressIntensityKI).toBe(0);
      expect(r.jointNormalForce).toBe(0);
      expect(r.jointMomentPerH).toBe(0);
    }
  });

  it('flags the crack and the beaten saw-cut in the warnings', () => {
    expect(out.warnings.some((w) => new RegExp(`Hour ${crackHour}:.*natural crack`).test(w))).toBe(true);
    expect(out.warnings.some((w) => /precedes the saw-cut/.test(w))).toBe(true);
  });

  it('marks the creep rows from the crack hour on as cracked', () => {
    for (const c of out.creepResults) {
      expect(c.cracked).toBe(c.hour >= crackHour);
    }
  });

  it('leaves the hours before the crack untouched (B is lower triangular)', () => {
    // A regime switch at hour i may not disturb rows already emitted.
    const bare = runStressModel(model(undefined));
    for (const c of out.creepResults.filter((x) => x.hour < crackHour)) {
      const b = bare.creepResults.find((x) => x.hour === c.hour)!;
      expect(c.creepMaxTensile).toBeCloseTo(b.creepMaxTensile, 10);
      expect(c.creepTotalStress).toBeCloseTo(b.creepTotalStress, 10);
    }
  });

  it('weaker concrete cracks no later than stronger concrete', () => {
    const early = runStressModel(model(CRACKS_EARLY)).cracking.naturalCrackHour!;
    const mid = runStressModel(model(CRACKS_MIDWAY)).cracking.naturalCrackHour!;
    expect(early).toBeLessThanOrEqual(mid);
    expect(early).toBe(START); // 200 psi is already exceeded on the first hour
  });

  it('reports the hours where the relieved slab still reaches its strength', () => {
    const weak = runStressModel(model(CRACKS_EARLY));
    const listed = weak.cracking.exceedanceHoursAfterRelief;
    const actual = weak.creepResults
      .filter((c) => c.demandCapacityRatio >= 1 && c.cracked)
      .map((c) => c.hour);
    expect(listed).toEqual(actual);
    if (listed.length) {
      expect(weak.warnings.some((w) => /additional cracking/.test(w))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// No pre-cut window to assess
// ---------------------------------------------------------------------------

describe('natural cracking – no continuous window', () => {
  it('verdict is jointedThroughout when no saw-cut hour is given', () => {
    const out = runStressModel(model(CRACKS_EARLY, { sawCutHour: undefined }));
    expect(out.cracking.verdict).toBe('jointedThroughout');
    expect(out.cracking.naturalCrackHour).toBeUndefined();
    expect(out.hourlyResults.every((r) => r.regime === 'jointed')).toBe(true);
  });

  it('verdict is jointedThroughout when the saw-cut precedes the set time', () => {
    const out = runStressModel(model(CRACKS_EARLY, { sawCutHour: START - 2 }));
    expect(out.cracking.verdict).toBe('jointedThroughout');
    expect(out.cracking.naturalCrackHour).toBeUndefined();
  });

  it('a strength history that misses the pre-cut hours cannot clear the saw-cut', () => {
    // Capacity known only from the saw-cut hour on: nothing was checked while
    // the slab was continuous, so the verdict must not be a clean "ok".
    const rows = hourlyInputs(NEVER_CRACKS).map((r) => ({
      ...r,
      tensileStrength: r.hour >= SAW_CUT ? NEVER_CRACKS : 0,
    }));
    const out = runStressModel(model(undefined, { hourlyInputs: rows }));
    expect(out.cracking.verdict).toBe('noStrengthData');
    expect(out.cracking.preCutPeakRatio).toBeUndefined();
  });

  it('a saw-cut beyond the window leaves the slab continuous and still crackable', () => {
    const out = runStressModel(model(CRACKS_MIDWAY, { sawCutHour: END + 10 }));
    expect(out.cracking.verdict).toBe('crackedBeforeSawCut');
    expect(out.cracking.naturalCrackHour).toBeLessThanOrEqual(END);
  });
});

// ---------------------------------------------------------------------------
// buildStressInput → strength wiring
// ---------------------------------------------------------------------------

function syntheticArgs(overrides: Partial<BuildStressInputArgs> = {}): BuildStressInputArgs {
  const thermal = Array.from({ length: 24 }, (_, i) => {
    const top = 30 - i * 1.5;
    const bottom = 28 - i * 0.2;
    return { temps: [top, (top + bottom) / 2, bottom] };
  });
  const maturity = Array.from({ length: 73 }, (_, h) => ({
    hour: h,
    degreeOfHydration: 0.85 * (1 - Math.exp(-h / 15)),
    strength: h >= 8 ? 20 * (h - 8) : 0, // ramps from 0 psi at set time
  }));
  return {
    startHour: 8,
    endHour: 24,
    slab: {
      thicknessIn: 9,
      jointSpacingFt: 15,
      poissonRatio: 0.15,
      coteF: 5.5e-6,
      kValue: 200,
      frictionCoefficient: 1.5,
    },
    matureModulusPsi: 4_000_000,
    alphaUltimate: 0.85,
    sawcutNormalized: 0.25,
    sawCutHour: 20,
    maturity,
    thermal,
    ...overrides,
  };
}

describe('buildStressInput – tensile strength wiring', () => {
  it('forwards the maturity strength history to the hourly inputs', () => {
    const { input, issues } = buildStressInput(syntheticArgs());
    expect(issues).toHaveLength(0);
    const row = input!.hourlyInputs.find((r) => r.hour === 16)!;
    expect(row.tensileStrength).toBeCloseTo(20 * (16 - 8), 6);
  });

  it('runs end-to-end and produces a cracking assessment', () => {
    const { input } = buildStressInput(syntheticArgs());
    const out = runStressModel(input!);
    expect(['ok', 'crackedBeforeSawCut']).toContain(out.cracking.verdict);
    expect(out.cracking.sawCutHour).toBe(20);
  });

  it('cracks this cooling fixture before the saw-cut and relieves the slab', () => {
    const { input } = buildStressInput(syntheticArgs());
    const out = runStressModel(input!);
    expect(out.cracking.verdict).toBe('crackedBeforeSawCut');
    const crackHour = out.cracking.naturalCrackHour!;
    expect(crackHour).toBeLessThan(20);
    expect(out.hourlyResults.filter((r) => r.hour >= crackHour).every((r) => r.regime === 'cracked')).toBe(true);
  });

  it('notes when the maturity rows carry no strength at all', () => {
    const bare = Array.from({ length: 73 }, (_, h) => ({
      hour: h,
      degreeOfHydration: 0.85 * (1 - Math.exp(-h / 15)),
    }));
    const { input, notes } = buildStressInput(syntheticArgs({ maturity: bare }));
    expect(input!.hourlyInputs.every((r) => r.tensileStrength === 0)).toBe(true);
    expect(notes.some((n) => /No tensile-strength data/i.test(n))).toBe(true);
    expect(runStressModel(input!).cracking.verdict).toBe('noStrengthData');
  });

  it('notes a partially-covered strength history', () => {
    const partial = Array.from({ length: 73 }, (_, h) => ({
      hour: h,
      degreeOfHydration: 0.85 * (1 - Math.exp(-h / 15)),
      strength: h >= 14 ? 300 : 0, // no capacity for hours 8–13
    }));
    const { notes } = buildStressInput(syntheticArgs({ maturity: partial }));
    expect(notes.some((n) => /Tensile strength available for/i.test(n))).toBe(true);
  });
});
