/**
 * Tests for concreteMaturity.ts
 *
 * Run with: npx vitest run concreteMaturity.test.ts
 * Or if using the SvelteKit default: npx vitest
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCementSystem,
  findNearestCuringTempC,
  getSetTimeHours,
  resolveParams,
  equivalentAgeIncrement,
  degreeOfHydration,
  heatOfHydration,
  computeKIC,
  kicToStrength,
  compressiveToTensile,
  scaledCompressive28,
  interpolateCompressiveCurve,
  runModel,
  getProjectSetTime,
  type ProjectInputs,
} from '../concreteMaturity';

// ---------------------------------------------------------------------------
// Helper: default inputs matching spreadsheet defaults (w/cm=0, Tr=23, Tc=5)
// When w/cm=0 and curingTempF=41°F → Tc=5°C after nearest-match
// ---------------------------------------------------------------------------
const DEFAULT_INPUTS: ProjectInputs = {
  cementType: 'Type I/II',
  scmType: 'None',
  wcm: 0.45,
  curingTempF: 77, // → 25°C
  sawcutDepth: 0.1,
};

// ---------------------------------------------------------------------------
// resolveCementSystem
// ---------------------------------------------------------------------------
describe('resolveCementSystem', () => {
  it('maps Type I/II with no SCM', () => {
    expect(resolveCementSystem('Type I/II', 'None')).toBe('Type I/II');
  });

  it('maps Type I/II w/ 5% Limestone', () => {
    expect(resolveCementSystem('Type I/II w/ 5% Limestone', 'None')).toBe('5% limestone');
  });

  it('maps PLC to 15% limestone', () => {
    expect(resolveCementSystem('PLC', 'None')).toBe('15% limestone');
  });

  it('SCM overrides cement type', () => {
    expect(resolveCementSystem('Type I/II', '25% C Ash')).toBe('25% C ash');
    expect(resolveCementSystem('PLC', '25% F Ash')).toBe('25% F ash');
    expect(resolveCementSystem('Type I/II', '25% GGBFS')).toBe('25% slag');
  });

  it('maps Custom SCM', () => {
    expect(resolveCementSystem('Type I/II', 'Custom')).toBe('Custom');
  });
});

// ---------------------------------------------------------------------------
// findNearestCuringTempC
// ---------------------------------------------------------------------------
describe('findNearestCuringTempC', () => {
  it('exact match', () => {
    expect(findNearestCuringTempC(25)).toBe(25);
  });

  it('rounds to nearest (22 → 20)', () => {
    expect(findNearestCuringTempC(22)).toBe(20);
  });

  it('rounds to nearest (23 → 25)', () => {
    expect(findNearestCuringTempC(23)).toBe(25);
  });

  it('below range clamps to 5', () => {
    expect(findNearestCuringTempC(-10)).toBe(5);
  });

  it('above range clamps to 35', () => {
    expect(findNearestCuringTempC(50)).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// getSetTimeHours
// ---------------------------------------------------------------------------
describe('getSetTimeHours', () => {
  it('Type I/II at 5°C → 9 hours', () => {
    expect(getSetTimeHours('Type I/II', 5)).toBe(9);
  });

  it('25% slag at 25°C → 6 hours', () => {
    expect(getSetTimeHours('25% slag', 25)).toBe(6);
  });

  it('5% limestone at 35°C → 5 hours', () => {
    expect(getSetTimeHours('5% limestone', 35)).toBe(5);
  });

  it('Custom falls back to 6', () => {
    expect(getSetTimeHours('Custom', 20)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// resolveParams
// ---------------------------------------------------------------------------
describe('resolveParams', () => {
  it('computes Cc from linear equation', () => {
    const p = resolveParams(DEFAULT_INPUTS);
    // Cc = -468779.695671 * 0.45 + 534506.710124
    const expected = -468779.695671 * 0.45 + 534506.710124;
    expect(p.Cc).toBeCloseTo(expected, 2);
  });

  it('computes Ea from quadratic equation', () => {
    const p = resolveParams(DEFAULT_INPUTS);
    const w = 0.45;
    const expected = -972943.722944 * w * w + 764647.186147 * w + -103860.4329;
    expect(p.Ea).toBeCloseTo(expected, 0);
  });

  it('alphaU is divided by 100', () => {
    const p = resolveParams(DEFAULT_INPUTS);
    const raw = 47.666667 * 0.45 + 72.067778;
    expect(p.alphaU).toBeCloseTo(raw / 100, 6);
  });

  it('Tc uses nearest curing temp from table', () => {
    const p = resolveParams(DEFAULT_INPUTS);
    // 77°F = 25°C, nearest is 25
    expect(p.Tc).toBe(25);
  });

  it('throws for Custom without customCoefficients', () => {
    expect(() =>
      resolveParams({ ...DEFAULT_INPUTS, scmType: 'Custom' }),
    ).toThrow('customCoefficients required');
  });
});

// ---------------------------------------------------------------------------
// equivalentAgeIncrement
// ---------------------------------------------------------------------------
describe('equivalentAgeIncrement', () => {
  it('returns 1.0 when Tc == Tr', () => {
    const p = resolveParams({ ...DEFAULT_INPUTS, curingTempF: 73.4 }); // ~23°C
    // When Tc ≈ Tr, exp(0) = 1, but table snaps to 25°C
    // So let's test with Tr = 25 explicitly
    const p2 = resolveParams({ ...DEFAULT_INPUTS, Tr: 25 });
    expect(equivalentAgeIncrement(p2)).toBeCloseTo(1.0, 3);
  });

  it('returns < 1 when Tc < Tr (cold curing slows maturity)', () => {
    const p = resolveParams({ ...DEFAULT_INPUTS, curingTempF: 41 }); // 5°C
    expect(equivalentAgeIncrement(p)).toBeLessThan(1);
  });

  it('returns > 1 when Tc > Tr (hot curing accelerates maturity)', () => {
    const p = resolveParams({ ...DEFAULT_INPUTS, curingTempF: 95 }); // 35°C
    expect(equivalentAgeIncrement(p)).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// degreeOfHydration
// ---------------------------------------------------------------------------
describe('degreeOfHydration', () => {
  it('returns 0 at te=0', () => {
    expect(degreeOfHydration(0.9, 10, 0.8, 0)).toBe(0);
  });

  it('approaches alphaU at very large te', () => {
    const alphaU = 0.935;
    const result = degreeOfHydration(alphaU, 10, 0.8, 1e6);
    expect(result).toBeCloseTo(alphaU, 3);
  });

  it('increases monotonically with te', () => {
    const a1 = degreeOfHydration(0.9, 10, 0.8, 5);
    const a2 = degreeOfHydration(0.9, 10, 0.8, 10);
    const a3 = degreeOfHydration(0.9, 10, 0.8, 50);
    expect(a2).toBeGreaterThan(a1);
    expect(a3).toBeGreaterThan(a2);
  });
});

// ---------------------------------------------------------------------------
// computeKIC
// ---------------------------------------------------------------------------
describe('computeKIC', () => {
  it('at hour=0, returns base value (-0.3448*wcm + 1.0375)', () => {
    const kic = computeKIC(0.45, 0);
    expect(kic).toBeCloseTo(-0.3448 * 0.45 + 1.0375, 6);
  });

  it('KIC decreases (becomes more negative) over time', () => {
    const k1 = computeKIC(0.45, 1);
    const k10 = computeKIC(0.45, 10);
    expect(k10).toBeLessThan(k1);
  });

  // Verify against spreadsheet cached value at w/cm=0, hour=0
  it('matches spreadsheet at w/cm=0, hour=0 → 1.0375', () => {
    expect(computeKIC(0, 0)).toBeCloseTo(1.0375, 4);
  });
});

// ---------------------------------------------------------------------------
// kicToStrength
// ---------------------------------------------------------------------------
describe('kicToStrength', () => {
  it('returns a finite number for positive KIC and depth', () => {
    const s = kicToStrength(1.0, 0.1);
    expect(Number.isFinite(s)).toBe(true);
  });

  it('scales linearly with KIC', () => {
    const s1 = kicToStrength(1.0, 0.1);
    const s2 = kicToStrength(2.0, 0.1);
    expect(s2).toBeCloseTo(s1 * 2, 2);
  });
});

// ---------------------------------------------------------------------------
// compressiveToTensile
// ---------------------------------------------------------------------------
describe('compressiveToTensile', () => {
  it('applies f_t = C·√f\'c (MOR 7.5)', () => {
    expect(compressiveToTensile(4000, 7.5)).toBeCloseTo(7.5 * Math.sqrt(4000), 4);
  });

  it('applies splitting-tensile coefficient (6.7)', () => {
    expect(compressiveToTensile(4000, 6.7)).toBeCloseTo(6.7 * Math.sqrt(4000), 4);
  });

  it('returns 0 for non-positive f\'c or coefficient', () => {
    expect(compressiveToTensile(0, 7.5)).toBe(0);
    expect(compressiveToTensile(-100, 7.5)).toBe(0);
    expect(compressiveToTensile(4000, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scaledCompressive28
// ---------------------------------------------------------------------------
describe('scaledCompressive28', () => {
  it('returns f\'c,28 when alphaT equals alpha28', () => {
    expect(scaledCompressive28(5000, 0.9, 0.3, 0.9)).toBeCloseTo(5000, 6);
  });

  it('returns 0 at or below the set degree of hydration alpha0', () => {
    expect(scaledCompressive28(5000, 0.3, 0.3, 0.9)).toBe(0);
    expect(scaledCompressive28(5000, 0.2, 0.3, 0.9)).toBe(0);
  });

  it('is half of f\'c,28 at the midpoint between alpha0 and alpha28', () => {
    expect(scaledCompressive28(5000, 0.6, 0.3, 0.9)).toBeCloseTo(2500, 6);
  });

  it('increases monotonically with alphaT', () => {
    const a = scaledCompressive28(5000, 0.4, 0.3, 0.9);
    const b = scaledCompressive28(5000, 0.6, 0.3, 0.9);
    const c = scaledCompressive28(5000, 0.8, 0.3, 0.9);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('returns 0 for a degenerate denominator (alpha28 <= alpha0)', () => {
    expect(scaledCompressive28(5000, 0.5, 0.6, 0.6)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// interpolateCompressiveCurve
// ---------------------------------------------------------------------------
describe('interpolateCompressiveCurve', () => {
  const pts = [
    { alpha: 0.4, fcPsi: 2000 },
    { alpha: 0.6, fcPsi: 4000 },
    { alpha: 0.8, fcPsi: 5000 },
  ];
  const alpha0 = 0.2;

  it('returns 0 at or below alpha0', () => {
    expect(interpolateCompressiveCurve(pts, alpha0, 0.2)).toBe(0);
    expect(interpolateCompressiveCurve(pts, alpha0, 0.1)).toBe(0);
  });

  it('hits the provided data points', () => {
    expect(interpolateCompressiveCurve(pts, alpha0, 0.4)).toBeCloseTo(2000, 6);
    expect(interpolateCompressiveCurve(pts, alpha0, 0.6)).toBeCloseTo(4000, 6);
    expect(interpolateCompressiveCurve(pts, alpha0, 0.8)).toBeCloseTo(5000, 6);
  });

  it('ramps linearly from the (alpha0, 0) origin to the first point', () => {
    // midpoint of [0.2, 0]→[0.4, 2000] is 0.3 → 1000
    expect(interpolateCompressiveCurve(pts, alpha0, 0.3)).toBeCloseTo(1000, 6);
  });

  it('interpolates linearly between interior points', () => {
    // midpoint of [0.4, 2000]→[0.6, 4000] is 0.5 → 3000
    expect(interpolateCompressiveCurve(pts, alpha0, 0.5)).toBeCloseTo(3000, 6);
  });

  it('holds the last value above the final point', () => {
    expect(interpolateCompressiveCurve(pts, alpha0, 0.95)).toBeCloseTo(5000, 6);
  });
});

// ---------------------------------------------------------------------------
// runModel — compressive → tensile strength
// ---------------------------------------------------------------------------
describe('runModel compressive strength', () => {
  const setHours = getProjectSetTime(DEFAULT_INPUTS); // 6 h for Type I/II @ 25°C

  it('28-day mode: strength equals ACI tensile of the scaled compressive', () => {
    const inputs: ProjectInputs = {
      ...DEFAULT_INPUTS,
      compressive: { mode: 'fc28', fc28Psi: 4000, tensileCoeff: 7.5 },
    };
    const results = runModel(inputs, 72);
    const r = results[72];
    expect(r.compressiveStrength).toBeGreaterThan(0);
    expect(r.strength).toBeCloseTo(compressiveToTensile(r.compressiveStrength!, 7.5), 6);
  });

  it('28-day mode: strength and compressive are 0 before set time', () => {
    const inputs: ProjectInputs = {
      ...DEFAULT_INPUTS,
      compressive: { mode: 'fc28', fc28Psi: 4000, tensileCoeff: 7.5 },
    };
    const results = runModel(inputs, 72);
    for (let h = 1; h < setHours; h++) {
      expect(results[h].strength).toBe(0);
      expect(results[h].compressiveStrength).toBe(0);
    }
    // grows after set
    expect(results[72].strength).toBeGreaterThan(0);
  });

  it('curve mode: produces tensile strength from ≥3 points', () => {
    const inputs: ProjectInputs = {
      ...DEFAULT_INPUTS,
      compressive: {
        mode: 'curve',
        curve: [
          { ageDays: 1, fcPsi: 2500 },
          { ageDays: 3, fcPsi: 3500 },
          { ageDays: 28, fcPsi: 5000 },
        ],
        tensileCoeff: 7.5,
      },
    };
    const results = runModel(inputs, 72);
    const r = results[72];
    expect(r.compressiveStrength).toBeGreaterThan(0);
    expect(r.strength).toBeCloseTo(compressiveToTensile(r.compressiveStrength!, 7.5), 6);
  });

  it('falls back to KIC strength when compressive config is invalid', () => {
    const inputs: ProjectInputs = {
      ...DEFAULT_INPUTS,
      sawcutDepth: 0.1,
      compressive: { mode: 'fc28', tensileCoeff: 7.5 }, // no fc28Psi → unusable
    };
    const results = runModel(inputs, 72);
    expect(results[72].compressiveStrength).toBeUndefined();
    expect(results[72].strength).toBeGreaterThan(0); // KIC path
  });

  it('curve mode with <3 valid points falls back to KIC', () => {
    const inputs: ProjectInputs = {
      ...DEFAULT_INPUTS,
      sawcutDepth: 0.1,
      compressive: {
        mode: 'curve',
        curve: [
          { ageDays: 1, fcPsi: 2500 },
          { ageDays: 3, fcPsi: 3500 },
        ],
        tensileCoeff: 7.5,
      },
    };
    const results = runModel(inputs, 72);
    expect(results[72].compressiveStrength).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// runModel
// ---------------------------------------------------------------------------
describe('runModel', () => {
  it('returns maxHours + 1 entries (0 through maxHours)', () => {
    const results = runModel(DEFAULT_INPUTS, 24);
    expect(results).toHaveLength(25);
  });

  it('hour 0 has all zeros', () => {
    const results = runModel(DEFAULT_INPUTS, 1);
    const h0 = results[0];
    expect(h0.hour).toBe(0);
    expect(h0.equivalentAge).toBe(0);
    expect(h0.degreeOfHydration).toBe(0);
    expect(h0.heatOfHydration).toBe(0);
    expect(h0.strength).toBe(0);
  });

  it('equivalent age increases monotonically', () => {
    const results = runModel(DEFAULT_INPUTS, 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].equivalentAge).toBeGreaterThan(results[i - 1].equivalentAge);
    }
  });

  it('degree of hydration increases monotonically', () => {
    const results = runModel(DEFAULT_INPUTS, 10);
    for (let i = 2; i < results.length; i++) {
      expect(results[i].degreeOfHydration).toBeGreaterThanOrEqual(
        results[i - 1].degreeOfHydration,
      );
    }
  });

  it('degree of hydration stays below alphaU', () => {
    const p = resolveParams(DEFAULT_INPUTS);
    const results = runModel(DEFAULT_INPUTS, 72);
    for (const r of results) {
      expect(r.degreeOfHydration).toBeLessThanOrEqual(p.alphaU + 1e-10);
    }
  });

  it('elasticModulus is 0 (lookup table not available)', () => {
    const results = runModel(DEFAULT_INPUTS, 5);
    for (const r of results) {
      expect(r.elasticModulus).toBe(0);
    }
  });

  it('works with different cement systems', () => {
    const systems: Array<[ProjectInputs['cementType'], ProjectInputs['scmType']]> = [
      ['Type I/II', 'None'],
      ['Type I/II w/ 5% Limestone', 'None'],
      ['PLC', 'None'],
      ['Type I/II', '25% C Ash'],
      ['Type I/II', '25% F Ash'],
      ['Type I/II', '25% GGBFS'],
    ];

    for (const [ct, scm] of systems) {
      const results = runModel({ ...DEFAULT_INPUTS, cementType: ct, scmType: scm }, 5);
      expect(results).toHaveLength(6);
      expect(results[5].degreeOfHydration).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getProjectSetTime
// ---------------------------------------------------------------------------
describe('getProjectSetTime', () => {
  it('Type I/II at 77°F (25°C) → 6 hours', () => {
    expect(getProjectSetTime(DEFAULT_INPUTS)).toBe(6);
  });

  it('25% F Ash at 41°F (5°C) → 9 hours', () => {
    const inputs: ProjectInputs = {
      ...DEFAULT_INPUTS,
      scmType: '25% F Ash',
      curingTempF: 41,
    };
    expect(getProjectSetTime(inputs)).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('very low w/cm (0.3) does not produce NaN', () => {
    const results = runModel({ ...DEFAULT_INPUTS, wcm: 0.3 }, 24);
    for (const r of results) {
      expect(Number.isFinite(r.degreeOfHydration)).toBe(true);
      expect(Number.isFinite(r.heatOfHydration)).toBe(true);
    }
  });

  it('high w/cm (0.6) does not produce NaN', () => {
    const results = runModel({ ...DEFAULT_INPUTS, wcm: 0.6 }, 24);
    for (const r of results) {
      expect(Number.isFinite(r.degreeOfHydration)).toBe(true);
      expect(Number.isFinite(r.heatOfHydration)).toBe(true);
    }
  });

  it('sawcutDepth=0 → strength=0', () => {
    const results = runModel({ ...DEFAULT_INPUTS, sawcutDepth: 0 }, 5);
    for (const r of results) {
      expect(r.strength).toBe(0);
    }
  });
});
