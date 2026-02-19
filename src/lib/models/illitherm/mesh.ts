import type { Layer } from './types';

export interface Mesh {
  dx: number[];
  alpha: number[];
  numElements: number;
  numNodes: number;
}

// VBA: CreateMesh
export function createMesh(layers: Layer[]): Mesh {
  let numElements = 0;
  for (let i = 0; i < layers.length; i += 1) {
    numElements += layers[i].numLayerElements;
  }

  const dx = new Array<number>(numElements);
  const alpha = new Array<number>(numElements);

  let elementCount = 0;
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const dxLayer = layer.thickness / layer.numLayerElements;
    const alphaLayer = layer.thermalConductivity / (layer.heatCapacity * layer.density);
    for (let j = 1; j <= layer.numLayerElements; j += 1) {
      dx[elementCount] = dxLayer;
      alpha[elementCount] = alphaLayer;
      elementCount += 1;
    }
  }

  if (elementCount !== numElements) {
    throw new Error('ielementcount != numElements in CreateMesh()!');
  }

  return { dx, alpha, numElements, numNodes: numElements + 1 };
}
