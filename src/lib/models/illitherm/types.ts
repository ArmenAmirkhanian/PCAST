export interface Surface {
  albedo: number;
  emissivity: number;
}

export interface Layer {
  thickness: number;
  thermalConductivity: number;
  heatCapacity: number;
  density: number;
  numLayerElements: number;
}

export interface WeatherRow {
  year: number;
  month: number;
  day: number;
  hour: number;
  airTemp: number;
  windSpeed: number;
  dewPoint: number;
  solarRad: number;
}

export interface HydrationParams {
  alphau: number;
  tau: number;
  Ea: number;
  R: number;
  Hu: number;
  cc: number;
  beta: number;
  Tr: number;
  Tdelivery: number;
}

export interface Controls {
  numStepsPerHour: number;
  spinUpReps: number;
  numPointsTopLayer?: number;
  sTime?: number;
}

export interface ModelInput {
  controls: Controls;
  surface: Surface;
  layers: Layer[];
  weather: WeatherRow[];
  hydration: HydrationParams;
}

export interface ResultRow {
  year: number;
  month: number;
  day: number;
  hour: number;
  temps: number[];
}

export interface ModelOutput {
  results: ResultRow[];
  creep?: ResultRow[];
}
