import { CToK, sigma_SB } from './constants';
import type { Layer, Surface, WeatherRow } from './types';

// VBA: LowerBoundary
export function lowerBoundary(layers: Layer[]): number {
  const xi = -0.01;
  const lastLayer = layers[layers.length - 1];
  return xi / (lastLayer.density * lastLayer.heatCapacity);
}

// VBA: Convection
export function convection(Ttop: number, weather: WeatherRow): number {
  const v = weather.windSpeed;
  const Tair = weather.airTemp;
  const h = 0.1 * (v ** 2);
  return -h * (Ttop - Tair);
}

// VBA: LW_Radiation
export function lwRadiation(Ttop: number, surface: Surface, weather: WeatherRow): number {
  const Tair = weather.airTemp;
  const eps = surface.emissivity;
  return -sigma_SB * eps * ((Ttop + CToK) ** 4 - (Tair + CToK) ** 4);
}

// VBA: SurfaceRad
export function surfaceRad(Ttop: number, weather: WeatherRow, surface: Surface): number {
  const qsolar = (1 - surface.albedo) * weather.solarRad;
  const qconv = convection(Ttop, weather);
  const qlwrad = lwRadiation(Ttop, surface, weather);
  return qsolar + qconv + qlwrad;
}
