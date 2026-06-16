/**
 * Tests for the additive theory-integration features:
 *   - signed top/bottom fibre stresses + creep transforms
 *   - per-hour diagnostics (pseudo-temps, edge factor, solver flag)
 *   - hour-alignment validation
 *   - the buildStressInput helper (E(t) = E_mature·α/α_u, ΔT vs set reference)
 */

import { describe, it, expect } from 'vitest';
import { runStressModel } from '../run';
import { buildStressInput, type BuildStressInputArgs } from '../inputs';
import type { StressModelInput, HourlyInput } from '../types';

function makeHourlyInputs(
  startHour: number,
  endHour: number,
  E = 3_000_000,
  dTc = -10,
  dTg = -20,
): HourlyInput[] {
  return Array.from({ length: endHour - startHour + 1 }, (_, idx) => ({
    hour: startHour + idx,
    elasticModulus: E * (1 - Math.exp(-idx / 10)),
    uniformTempChange: dTc,
    gradientTempChange: dTg,
  }));
}

const BASE_INPUT: StressModelInput = {
  startHour: 10,
  endHour: 20,
  slab: {
    thickness: 9,
    poissonRatio: 0.15,
    cote: 5e-6,
    kValue: 100,
    jointSpacingFt: 15,
    frictionCoefficient: 1,
  },
  hourlyInputs: makeHourlyInputs(10, 20),
};

// ---------------------------------------------------------------------------
// Signed extreme-fibre stresses
// ---------------------------------------------------------------------------

describe('runStressModel – signed top/bottom fibre stresses', () => {
  it('stressTop + stressBottom = 2·normalStress and difference = 2·bendingStress', () => {
    const out = runStressModel(BASE_INPUT);
    for (const r of out.hourlyResults) {
      expect(r.stressTop + r.stressBottom).toBeCloseTo(2 * r.normalStress, 6);
      expect(r.stressTop - r.stressBottom).toBeCloseTo(2 * r.bendingStress, 6);
      expect(r.maxTensileStress).toBeCloseTo(Math.max(r.stressTop, r.stressBottom), 10);
    }
  });

  it('totalStress equals stressTop (top-fibre convention preserved)', () => {
    const out = runStressModel(BASE_INPUT);
    for (const r of out.hourlyResults) {
      expect(r.totalStress).toBeCloseTo(r.stressTop, 10);
    }
  });

  it('creep top/bottom/maxTensile are finite and maxTensile = max(top, bottom)', () => {
    const out = runStressModel(BASE_INPUT);
    for (const c of out.creepResults) {
      expect(Number.isFinite(c.creepStressTop)).toBe(true);
      expect(Number.isFinite(c.creepStressBottom)).toBe(true);
      expect(c.creepMaxTensile).toBeCloseTo(
        Math.max(c.creepStressTop, c.creepStressBottom),
        10,
      );
    }
  });

  it('a sign-reversing gradient produces opposite-sign top/bottom (no abs collapse)', () => {
    const inputs = makeHourlyInputs(10, 20).map((h, i) => ({
      ...h,
      gradientTempChange: i % 2 === 0 ? 20 : -20, // alternate sign
    }));
    const out = runStressModel({ ...BASE_INPUT, hourlyInputs: inputs });
    // At least one hour must have top and bottom of opposite sign — impossible
    // if bending were stored as a magnitude.
    const reversed = out.hourlyResults.some(
      (r) => Math.sign(r.stressTop) !== Math.sign(r.stressBottom) && r.elasticModulus > 0,
    );
    expect(reversed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

describe('runStressModel – diagnostics', () => {
  it('exposes pseudo-temperatures, edge factor, and solver flag', () => {
    const out = runStressModel(BASE_INPUT);
    expect(Array.isArray(out.warnings)).toBe(true);
    for (const r of out.hourlyResults) {
      expect(Number.isFinite(r.pseudoUniformTemp)).toBe(true);
      expect(Number.isFinite(r.pseudoGradientTemp)).toBe(true);
      expect(Number.isFinite(r.edgeBendingFactor)).toBe(true);
      expect(typeof r.solverOk).toBe('boolean');
    }
  });

  it('zero-gradient run is finite (no NaN) and records no fatal error', () => {
    const inputs = makeHourlyInputs(10, 20, 3_000_000, -10, 0); // ΔT_g = 0
    const out = runStressModel({ ...BASE_INPUT, hourlyInputs: inputs });
    for (const r of out.hourlyResults) {
      expect(Number.isFinite(r.bendingStress)).toBe(true);
      expect(Number.isFinite(r.totalStress)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Hour-alignment validation
// ---------------------------------------------------------------------------

describe('runStressModel – hour-alignment validation', () => {
  it('throws when an hourly row is out of sequence', () => {
    const inputs = makeHourlyInputs(10, 20);
    inputs[3].hour = 999; // break the sequence
    expect(() => runStressModel({ ...BASE_INPUT, hourlyInputs: inputs })).toThrow(RangeError);
  });

  it('throws when array length mismatches the window', () => {
    const inputs = makeHourlyInputs(10, 19); // one short
    expect(() => runStressModel({ ...BASE_INPUT, hourlyInputs: inputs })).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// buildStressInput helper
// ---------------------------------------------------------------------------

function syntheticArgs(overrides: Partial<BuildStressInputArgs> = {}): BuildStressInputArgs {
  // thermal[i] is hour i+1; 24 hours of a simple cooling gradient
  const thermal = Array.from({ length: 24 }, (_, i) => {
    const top = 30 - i * 0.5;      // °C surface cooling over time
    const bottom = 28 - i * 0.2;   // bottom cools slower
    return { temps: [top, (top + bottom) / 2, bottom] };
  });
  const maturity = Array.from({ length: 73 }, (_, h) => ({
    hour: h,
    degreeOfHydration: 0.85 * (1 - Math.exp(-h / 15)),
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
    maturity,
    thermal,
    ...overrides,
  };
}

describe('buildStressInput', () => {
  it('builds a valid input that runStressModel accepts', () => {
    const { input, issues } = buildStressInput(syntheticArgs());
    expect(issues).toHaveLength(0);
    expect(input).not.toBeNull();
    const out = runStressModel(input!);
    expect(out.hourlyResults).toHaveLength(24 - 8 + 1);
  });

  it('E(t) = E_mature·α/α_u, clamped to ≤ E_mature', () => {
    const { input } = buildStressInput(syntheticArgs());
    const row = input!.hourlyInputs.find((r) => r.hour === 16)!;
    const alpha16 = 0.85 * (1 - Math.exp(-16 / 15));
    expect(row.elasticModulus).toBeCloseTo(4_000_000 * (alpha16 / 0.85), 0);
    for (const r of input!.hourlyInputs) {
      expect(r.elasticModulus).toBeLessThanOrEqual(4_000_000 + 1);
    }
  });

  it('ΔT_c and ΔT_g are zero at the set time (stress-free reference)', () => {
    const { input } = buildStressInput(syntheticArgs());
    const first = input!.hourlyInputs[0];
    expect(first.hour).toBe(8);
    expect(first.uniformTempChange).toBeCloseTo(0, 10);
    expect(first.gradientTempChange).toBeCloseTo(0, 10);
  });

  it('reports issues and returns null input when thermal data is missing', () => {
    const { input, issues } = buildStressInput(syntheticArgs({ thermal: [] }));
    expect(input).toBeNull();
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags set times below the creep-model validity floor (≥ 1 h)', () => {
    const { input, issues } = buildStressInput(syntheticArgs({ startHour: 0 }));
    expect(input).toBeNull();
    expect(issues.some((i) => /set time/i.test(i))).toBe(true);
  });

  it('accepts early set times (3–4 h) that the old logarithmic placeholder rejected', () => {
    // The bounded aging-modulus models stay positive below ~5 h, so set times
    // that the old E_eff = a + b·ln(t) fit drove non-positive are now valid.
    const { input, issues } = buildStressInput(syntheticArgs({ startHour: 3 }));
    expect(issues).toHaveLength(0);
    expect(input).not.toBeNull();
    expect(input!.startHour).toBe(3);
    const out = runStressModel(input!);
    for (const r of out.creepResults) {
      expect(Number.isFinite(r.creepTotalStress)).toBe(true);
    }
  });

  it('clamps the analysis window to available thermal data and notes it', () => {
    const { input, notes } = buildStressInput(syntheticArgs({ endHour: 72 }));
    expect(input!.endHour).toBe(24);
    expect(notes.some((n) => /clamped/i.test(n))).toBe(true);
  });

  it('clamps the window to the maturity horizon when shorter than thermal', () => {
    const shortMaturity = Array.from({ length: 15 }, (_, h) => ({
      hour: h,
      degreeOfHydration: 0.85 * (1 - Math.exp(-h / 15)),
    }));
    const { input, notes } = buildStressInput(
      syntheticArgs({ maturity: shortMaturity, endHour: 24 }),
    );
    expect(input!.endHour).toBe(14); // hours 0..14 available
    expect(notes.some((n) => /degree-of-hydration/i.test(n))).toBe(true);
  });

  it('treats sawcutNormalized = 0 as a free joint (no throw)', () => {
    const { input, issues, notes } = buildStressInput(
      syntheticArgs({ sawcutNormalized: 0 }),
    );
    expect(issues).toHaveLength(0);
    expect(input).not.toBeNull();
    expect(input!.sawcutNormalized).toBeUndefined();
    expect(notes.some((n) => /free/i.test(n))).toBe(true);
    expect(() => runStressModel(input!)).not.toThrow();
  });

  it('flags sawcutNormalized > 0.7 as a blocking issue (not a raw RangeError)', () => {
    const { input, issues } = buildStressInput(syntheticArgs({ sawcutNormalized: 0.85 }));
    expect(input).toBeNull();
    expect(issues.some((i) => /sawcut/i.test(i))).toBe(true);
  });

  it('forwards an in-window sawCutHour and notes the continuous-until-cut regime', () => {
    const { input, notes } = buildStressInput(syntheticArgs({ sawCutHour: 14 }));
    expect(input!.sawCutHour).toBe(14);
    expect(notes.some((n) => /continuous.*until the saw-cut at hour 14/i.test(n))).toBe(true);
  });

  it('notes when the saw-cut falls at/before the set time (jointed throughout)', () => {
    // startHour defaults to 8 in syntheticArgs.
    const { input, notes } = buildStressInput(syntheticArgs({ sawCutHour: 6 }));
    expect(input!.sawCutHour).toBe(6);
    expect(notes.some((n) => /at\/before the set time/i.test(n))).toBe(true);
  });

  it('notes when no saw-cut time is supplied (jointed throughout)', () => {
    const { input, notes } = buildStressInput(syntheticArgs());
    expect(input!.sawCutHour).toBeUndefined();
    expect(notes.some((n) => /No saw-cut time supplied/i.test(n))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Per-DOF joint solve (asymmetric joint must not lose the non-singular DOF)
// ---------------------------------------------------------------------------

describe('runStressModel – per-DOF joint compatibility solve', () => {
  it('keeps the normal-DOF reaction when only the rotational DOF is singular', () => {
    // Zero gradient → zero pseudo-gradient → θ = 0 → rotational plate stiffness 0;
    // with rotationalStiffnessOverE = 0 the rotational DOF is singular. The normal
    // DOF is well-posed (non-zero uniform ΔT + normal joint stiffness) and must
    // retain its reaction — a shared-determinant solve would zero it.
    const inputs = makeHourlyInputs(10, 20, 3_000_000, -10, 0);
    const out = runStressModel({
      ...BASE_INPUT,
      hourlyInputs: inputs,
      joint: {
        normalStiffnessOverE: 0.5,
        rotationalStiffnessOverE: 0,
        axialSifCoeff: 1,
        bendingSifCoeff: 1,
      },
    });
    const active = out.hourlyResults.filter((r) => r.elasticModulus > 0);
    expect(active.some((r) => Math.abs(r.jointNormalForce) > 1e-6)).toBe(true);
    // rotational DOF is singular → moment reaction zero, recorded as a warning
    expect(active.every((r) => Math.abs(r.jointMomentPerH) < 1e-9)).toBe(true);
    expect(out.warnings.some((w) => /rotational-DOF/.test(w))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Saw-cut timing: continuous (infinite) slab until the joint is cut
// ---------------------------------------------------------------------------

describe('runStressModel – saw-cut timing regime', () => {
  // A sawcut joint with enough modulus everywhere so every hour is "active".
  const sawcut = (extra: Partial<StressModelInput> = {}): StressModelInput => ({
    ...BASE_INPUT,
    hourlyInputs: makeHourlyInputs(10, 20, 3_000_000, -10, -20).map((r) => ({
      ...r,
      elasticModulus: 3_000_000, // constant, non-zero so no zero rows mask the regime
    })),
    sawcutNormalized: 0.25,
    ...extra,
  });

  it('omitting sawCutHour reproduces the legacy jointed-throughout result', () => {
    const a = runStressModel(sawcut());
    const b = runStressModel(sawcut({ sawCutHour: undefined }));
    for (let i = 0; i < a.hourlyResults.length; i++) {
      expect(a.hourlyResults[i].totalStress).toBeCloseTo(b.hourlyResults[i].totalStress, 10);
    }
  });

  it('before the cut: no joint reaction and KI = 0; after the cut: joint engages', () => {
    const cut = 15;
    const out = runStressModel(sawcut({ sawCutHour: cut }));
    const before = out.hourlyResults.filter((r) => r.hour < cut);
    const after = out.hourlyResults.filter((r) => r.hour >= cut);

    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);

    for (const r of before) {
      expect(r.stressIntensityKI).toBe(0);
      expect(r.jointNormalForce).toBe(0);
      expect(r.jointMomentPerH).toBe(0);
    }
    // The sawcut joint produces a non-zero KI on at least one post-cut hour.
    expect(after.some((r) => Math.abs(r.stressIntensityKI) > 1e-6)).toBe(true);
  });

  it('pre-cut stresses are the fully-restrained maxima (≥ relieved jointed values)', () => {
    const cut = 15;
    const out = runStressModel(sawcut({ sawCutHour: cut }));
    // Same model with the joint active from the start (no infinite regime).
    const jointed = runStressModel(sawcut());

    // For an identical hour, the continuous (pre-cut) curling/axial demand must
    // not be smaller than the relieved jointed demand — the free edge + joint
    // only relax stress. Compare the extreme-fibre magnitude per hour.
    for (const r of out.hourlyResults.filter((x) => x.hour < cut)) {
      const j = jointed.hourlyResults.find((x) => x.hour === r.hour)!;
      const pre = Math.max(Math.abs(r.stressTop), Math.abs(r.stressBottom));
      const relieved = Math.max(Math.abs(j.stressTop), Math.abs(j.stressBottom));
      expect(pre).toBeGreaterThanOrEqual(relieved - 1e-6);
    }
  });

  it('moving the saw-cut later changes the stress history (timing matters)', () => {
    const early = runStressModel(sawcut({ sawCutHour: 12 }));
    const late = runStressModel(sawcut({ sawCutHour: 18 }));
    const earlySum = early.hourlyResults.reduce((s, r) => s + r.totalStress, 0);
    const lateSum = late.hourlyResults.reduce((s, r) => s + r.totalStress, 0);
    expect(earlySum).not.toBeCloseTo(lateSum, 3);
  });

  it('a frictionless interface carries zero axial stress in the continuous regime', () => {
    const out = runStressModel(
      sawcut({
        sawCutHour: 18,
        slab: { ...BASE_INPUT.slab, frictionCoefficient: 0 },
      }),
    );
    // Before the cut, axial (normal) stress must be exactly zero with kh = 0.
    for (const r of out.hourlyResults.filter((x) => x.hour < 18)) {
      expect(r.normalStress).toBe(0);
    }
  });
});
