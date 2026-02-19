import { R_gas } from './constants';
import { interpolateSurfaceLayer, interpolateSurfaceLayerFahrenheit } from './interp';
import { assembleGlobalLHS } from './lhs';
import { createMesh } from './mesh';
import { lowerBoundary, surfaceRad } from './physics';
import { assembleGlobalRHS, assembleGlobalSourceRHS } from './rhs';
import { triDiagSolve } from './solver';
import type { HydrationParams, ModelInput, ModelOutput, ResultRow } from './types';

// VBA: RunThermalGradientAnalysis
export function runModel(input: ModelInput): ModelOutput {
  const { controls, surface, weather } = input;
  const layers = input.layers;

  const numStepsPerHour = controls.numStepsPerHour;
  const spinUpReps = controls.spinUpReps;
  const numPointsTopLayer = controls.numPointsTopLayer ?? 11;
  const sTime = controls.sTime;

  const params: HydrationParams = { ...input.hydration, R: R_gas };

  const { dx, alpha, numElements, numNodes } = createMesh(layers);
  const dt = 3600 / numStepsPerHour;

  const Told = new Array<number>(numNodes);

  for (let i = 0; i < numNodes; i += 1) {
    Told[i] = params.Tdelivery;
  }

  const te_avg = new Array<number>(numElements).fill(0);
  const qdeep = lowerBoundary(layers);

  const { lhsa, lhsb, lhsc } = assembleGlobalLHS(dt, numElements, alpha, dx);

  const results: ResultRow[] = [];
  const creep: ResultRow[] = [];
  let rowOut = 2;

  for (let ispin = 0; ispin < spinUpReps; ispin += 1) {
    for (let ihour = 0; ihour < weather.length; ihour += 1) {
      if (ispin === spinUpReps - 1) {
        const temps = interpolateSurfaceLayer(numPointsTopLayer, layers[0], Told);
        results.push({
          year: weather[ihour].year,
          month: weather[ihour].month,
          day: weather[ihour].day,
          hour: weather[ihour].hour,
          temps
        });

        if (sTime !== undefined && rowOut > sTime) {
          const tempsF = interpolateSurfaceLayerFahrenheit(numPointsTopLayer, layers[0], Told);
          creep.push({
            year: weather[ihour].year,
            month: weather[ihour].month,
            day: weather[ihour].day,
            hour: weather[ihour].hour,
            temps: tempsF
          });
        }

        rowOut += 1;
      }

      for (let it = 1; it <= numStepsPerHour; it += 1) {
        const rhsd = assembleGlobalRHS(Told, dx, numElements);

        if (ispin === spinUpReps - 1) {
          const rhsq = assembleGlobalSourceRHS(Told, dt, numElements, layers[0], params, te_avg);
          for (let i = 0; i < numNodes; i += 1) {
            rhsd[i] = rhsd[i] + (dt * rhsq[i]) / (layers[0].density * layers[0].heatCapacity);
          }
        }

        let qsurf = surfaceRad(Told[0], weather[ihour], surface);
        qsurf = qsurf / (layers[0].density * layers[0].heatCapacity);

        rhsd[0] = rhsd[0] + qsurf * dt;
        rhsd[numNodes - 1] = rhsd[numNodes - 1] + qdeep * dt;

        const solved = triDiagSolve(lhsa, lhsb, lhsc, rhsd);
        for (let i = 0; i < numNodes; i += 1) {
          Told[i] = solved[i];
        }
      }
    }
  }

  const output: ModelOutput = { results };
  if (sTime !== undefined) {
    output.creep = creep;
  }

  return output;
}
