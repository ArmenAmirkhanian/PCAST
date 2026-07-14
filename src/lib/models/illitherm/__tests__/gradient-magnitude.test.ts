import { describe, expect, it } from 'vitest';
import { runModel } from '../run';
import type { Layer, ModelInput, WeatherRow } from '../types';

/**
 * Regression guard for the "extremely high gradient" bug.
 *
 * Two setup defects in the Results-tab model input made slab temperatures run
 * ~130–190 °F:
 *   1. The subgrade layer was omitted, making the slab base adiabatic and
 *      trapping hydration heat.
 *   2. Wind was passed in m/s to the convection correlation h = 0.1·v², which
 *      expects mph, so surface convective cooling was ~5× too weak.
 *
 * This test rebuilds the same model input the component produces (slab + 1 m
 * subgrade, wind converted to mph) and asserts the peak temperature stays in a
 * physically plausible band for hot-weather concreting. It also verifies that
 * re-introducing either defect pushes the peak meaningfully higher, so the
 * fixes can't silently regress.
 */

const MPS_TO_MPH = 2.23694;
const thicknessM = 10 * 0.0254; // 10-inch slab

function estimateSolarRad(hour: number, cloudPct: number): number {
  if (hour < 6 || hour > 20) return 0;
  const sunFraction = Math.sin((Math.PI * (hour - 6)) / 14);
  const cloudFactor = 1 - (cloudPct / 100) * 0.75;
  return Math.max(0, 600 * sunFraction * cloudFactor);
}

// 72 h of a mild summer diurnal cycle (air 18–32 °C, light breeze).
function makeWeather(windMps: number): WeatherRow[] {
  const rows: WeatherRow[] = [];
  for (let h = 0; h < 72; h++) {
    const hourOfDay = h % 24;
    const airTemp = 25 + 7 * Math.sin((Math.PI * (hourOfDay - 9)) / 12);
    rows.push({
      year: 2024, month: 7, day: 1, hour: hourOfDay,
      airTemp,
      windSpeed: windMps,
      dewPoint: airTemp - 5,
      solarRad: estimateSolarRad(hourOfDay, 30)
    });
  }
  return rows;
}

const slabLayer: Layer = {
  thickness: thicknessM, thermalConductivity: 1.5,
  heatCapacity: 840, density: 2300, numLayerElements: 10
};
const subgradeLayer: Layer = {
  thickness: 1.0, thermalConductivity: 1.2,
  heatCapacity: 900, density: 1800, numLayerElements: 10
};

function makeInput(layers: Layer[], windMps: number, windScale: number): ModelInput {
  return {
    controls: { numStepsPerHour: 4, spinUpReps: 2, numPointsTopLayer: 11 },
    surface: { albedo: 0.5, emissivity: 0.9 },
    layers,
    weather: makeWeather(windMps * windScale),
    hydration: {
      alphau: 0.87, tau: 12.5, Ea: 33500, R: 8.3144,
      Hu: 375000, cc: 350, beta: 1.0, Tr: 23, Tdelivery: 23
    }
  };
}

function peakC(out: ReturnType<typeof runModel>): number {
  let max = -Infinity;
  for (const r of out.results) for (const t of r.temps) if (t > max) max = t;
  return max;
}

describe('slab temperature-gradient magnitude', () => {
  const WIND_MPS = 3;

  it('peak temperature stays physically plausible with subgrade + mph wind', () => {
    // Matches what TemperatureGradientChart.svelte builds: slab + subgrade,
    // wind converted from m/s to mph for the convection correlation.
    const out = runModel(makeInput([slabLayer, subgradeLayer], WIND_MPS, MPS_TO_MPH));
    const peak = peakC(out);
    const peakF = peak * 1.8 + 32;

    // Above ambient peak (32 °C) — hydration must warm the slab — but well below
    // the runaway ~55–90 °C the buggy setup produced.
    expect(peak).toBeGreaterThan(32);
    expect(peak).toBeLessThan(50);
    expect(peakF).toBeLessThan(122); // < 122 °F, not the 130–190 °F of the bug
  });

  it('omitting the subgrade raises the peak (documents the trapped-heat defect)', () => {
    const fixed = peakC(runModel(makeInput([slabLayer, subgradeLayer], WIND_MPS, MPS_TO_MPH)));
    const noSubgrade = peakC(runModel(makeInput([slabLayer], WIND_MPS, MPS_TO_MPH)));
    expect(noSubgrade).toBeGreaterThan(fixed + 2);
  });

  it('feeding wind in m/s (no mph conversion) raises the peak (documents the unit defect)', () => {
    const fixed = peakC(runModel(makeInput([slabLayer, subgradeLayer], WIND_MPS, MPS_TO_MPH)));
    const wrongUnits = peakC(runModel(makeInput([slabLayer, subgradeLayer], WIND_MPS, 1)));
    expect(wrongUnits).toBeGreaterThan(fixed + 2);
  });
});
