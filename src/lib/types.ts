export type UnitSystem = 'us' | 'metric';

export type ProjectInfoForm = {
  state: string;        // USPS abbreviation (e.g., "AL")
  city: string;         // must match places-index for selected state
  date: string;         // yyyy-mm-dd; no past dates allowed
  startHour: string;    // "05:00" (24h, whole hours only)
  startTempF: number|'';       // canonical internal units: °F
  deliveryTempF: number|'';    // canonical internal units: °F
};

export type CityLocation = {
  city: string;
  latitude: number | null;
  longitude: number | null;
};

export type PlacesIndex = Record<string, CityLocation[]>;

export type MaterialsForm = {
  cementType: 'Type I/II' | 'Type I/II with 5% limestone';
  scm: 'None' | '25% C Ash' | '25% F ash' | '25% slag';
  waterCementRatio: number | '';
  curing: 'Curing Compound' | 'No Curing Compound';
};

export type SlabLayoutForm = {
  thickness: number | '';
  jointSpacing: number | '';
  sawCutHour: string;
  jointType: 'Aggregate Interlock' | 'Aggregate Interlock with Dowels';
  baseType: string;
};

export type WeatherStation = {
  stationId: number;
  ghcnId: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  distanceKm: number;
};
