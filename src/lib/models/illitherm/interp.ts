import type { Layer } from './types';

// VBA: PWL_interp
export function pwlInterp(x: number[], xp: number[], yp: number[], dxlayer: number): number[] {
  const n = x.length;
  const y = new Array<number>(n);

  for (let i = 0; i < n; i += 1) {
    let idx1 = Math.floor(x[i] / dxlayer);
    if (idx1 < 0) idx1 = 0;
    if (idx1 >= yp.length - 1) idx1 = yp.length - 2;
    let idx2 = idx1 + 1;
    if (idx2 > yp.length - 1) idx2 = yp.length - 1;

    y[i] = yp[idx1] + ((yp[idx2] - yp[idx1]) * (x[i] - xp[idx1])) / dxlayer;
  }

  return y;
}

// VBA: WriteSurfaceLayer
export function interpolateSurfaceLayer(
  numPointsTopLayer: number,
  topLayer: Layer,
  Told: number[]
): number[] {
  const xp = new Array<number>(topLayer.numLayerElements + 1);
  const yp = new Array<number>(topLayer.numLayerElements + 1);
  const x = new Array<number>(numPointsTopLayer);

  const dxlayer = topLayer.thickness / topLayer.numLayerElements;

  for (let i = 0; i <= topLayer.numLayerElements; i += 1) {
    xp[i] = dxlayer * i;
    yp[i] = Told[i];
  }

  for (let i = 0; i < numPointsTopLayer; i += 1) {
    x[i] = (topLayer.thickness / (numPointsTopLayer - 1)) * i;
  }

  return pwlInterp(x, xp, yp, dxlayer);
}

// VBA: WriteSurfaceLayerCreep
export function interpolateSurfaceLayerFahrenheit(
  numPointsTopLayer: number,
  topLayer: Layer,
  Told: number[]
): number[] {
  const interpolated = interpolateSurfaceLayer(numPointsTopLayer, topLayer, Told);
  for (let i = 0; i < interpolated.length; i += 1) {
    interpolated[i] = interpolated[i] * 1.8 + 32;
  }
  return interpolated;
}
