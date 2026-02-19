import { describe, expect, it } from 'vitest';
import { runModel } from '../run';
import type { ModelInput } from '../types';

/**
 * This test suite is designed around what runModel() actually does:
 * - It PUSHES a ResultRow *before* stepping forward for that hour.
 *   So results[i] represents the temperature state at the START of weather hour i.
 *
 * To test that the solver actually evolves temperatures, we must provide >= 2 weather rows,
 * so results[1] reflects the state AFTER completing the time-stepping for weather[0].
 */

function cloneInput<T>(obj: T): T {
  // Node 18+ has structuredClone; this fallback keeps the test portable.
  // If your environment supports structuredClone, you can swap it in.
  return JSON.parse(JSON.stringify(obj)) as T;
}

const baseInput: ModelInput = {
  controls: {
    numStepsPerHour: 1,
    spinUpReps: 1,
    numPointsTopLayer: 11,
    sTime: 1
  },
  surface: {
    albedo: 0.2,
    emissivity: 0.9
  },
  layers: [
    {
      thickness: 0.1,
      thermalConductivity: 1.5,
      heatCapacity: 900,
      density: 2200,
      numLayerElements: 2
    },
    {
      thickness: 1.0,
      thermalConductivity: 1.2,
      heatCapacity: 900,
      density: 2200,
      numLayerElements: 10
    }
  ],
  weather: [
    // NOTE: Individual tests will override this array as needed.
    {
      year: 2024,
      month: 1,
      day: 1,
      hour: 0,
      airTemp: 10,
      windSpeed: 1,
      dewPoint: 5,
      solarRad: 0
    }
  ],
  hydration: {
    alphau: 0.7,
    tau: 10,
    Ea: 40000,
    R: 8.3144,
    Hu: 1,
    cc: 1,
    beta: 1,
    Tr: 20,
    Tdelivery: 15
  }
};

describe('runModel', () => {
  it('records the pre-step (initial) temperature profile for the first hour', () => {
    const input = cloneInput(baseInput);
    input.weather = [
      { ...baseInput.weather[0], hour: 0 }
    ];

    const out = runModel(input);

    // results is pushed once per weather hour on the final spin-up rep
    expect(out.results).toHaveLength(1);
    expect(out.results[0].temps).toHaveLength(input.controls.numPointsTopLayer ?? 11);

    // Because results[0] is pushed BEFORE any stepping, it should reflect initialization (Tdelivery)
    const Tdelivery = input.hydration.Tdelivery;
    for (const t of out.results[0].temps) {
      // near-exact check
      expect(t).toBeCloseTo(Tdelivery, 10);
    }
  });

  it('evolves temperatures after stepping: results[1] should differ from results[0] when there are 2 hours', () => {
    const input = cloneInput(baseInput);

    // Two weather hours so that results[1] is the state after completing the stepping for hour 0
    input.weather = [
      { ...baseInput.weather[0], hour: 0, solarRad: 0, airTemp: 10, windSpeed: 1, dewPoint: 5 },
      { ...baseInput.weather[0], hour: 1, solarRad: 0, airTemp: 10, windSpeed: 1, dewPoint: 5 }
    ];

    const out = runModel(input);

    expect(out.results).toHaveLength(2);

    const t0 = out.results[0].temps;
    const t1 = out.results[1].temps;

    // t0 should be initialized to Tdelivery (pre-step)
    const Tdelivery = input.hydration.Tdelivery;
    for (const t of t0) {
      expect(t).toBeCloseTo(Tdelivery, 10);
    }

    // t1 should reflect the state after time-stepping the first hour.
    // We don't assume direction (warming/cooling) here, only that something changed.
    const maxAbsDelta = Math.max(...t1.map((v, i) => Math.abs(v - t0[i])));
    expect(maxAbsDelta).toBeGreaterThan(1e-8);

    // Optional sanity: surface node typically changes at least as much as some deeper node.
    // This is a very weak check, but can catch "surface flux not applied at all".
    expect(Math.abs(t1[0] - t0[0])).toBeGreaterThan(0);
  });

  it('creep output is recorded (when sTime condition is met) and is a Fahrenheit conversion of the corresponding C temps', () => {
    const input = cloneInput(baseInput);

    // Need at least one hour for creep to have an entry. With your current runModel logic:
    // rowOut starts at 2, so sTime=1 will include creep for hour 0.
    input.controls.sTime = 1;
    input.weather = [
      { ...baseInput.weather[0], hour: 0 }
    ];

    const out = runModel(input);

    expect(out.creep).toBeDefined();
    expect(out.creep).toHaveLength(1);

    const cTemps = out.results[0].temps;
    const fTemps = out.creep?.[0].temps ?? [];

    expect(fTemps).toHaveLength(cTemps.length);

    for (let i = 0; i < cTemps.length; i += 1) {
      const expectedF = cTemps[i] * 1.8 + 32;
      expect(fTemps[i]).toBeCloseTo(expectedF, 8);
    }
  });
});
