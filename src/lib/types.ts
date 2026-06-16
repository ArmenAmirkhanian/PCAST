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

export type HydrationModel = 'bentz' | 'schindler-folliard';

/** How the user specifies compressive strength on the Materials tab. */
export type StrengthInputMode = 'fc28' | 'curve';

/** ACI compressive→tensile preset; 'custom' lets the user set the coefficient. */
export type TensilePreset = 'mor' | 'split' | 'custom';

/** One point of a user-entered strength development curve. */
export type StrengthCurvePoint = {
  ageDays: number | '';
  /** Compressive strength, canonical psi (UI converts to/from MPa for display) */
  fcPsi: number | '';
};

export type MaterialsForm = {
  cementType: 'Type I/II' | 'Type I/II with 5% limestone';
  scm: 'None' | '25% C Ash' | '25% F ash' | '25% slag';
  waterCementRatio: number | '';
  curing: 'Curing Compound' | 'No Curing Compound';
  hydrationModel: HydrationModel | null;
  hydrationModelInputs: Record<string, number | ''>;
  /** 28-day single value vs development curve */
  strengthInputMode: StrengthInputMode;
  /** 28-day compressive strength, canonical psi (mode 'fc28') */
  fc28Psi: number | '';
  /** Development curve points (mode 'curve'); ages in days, f'c canonical psi */
  strengthCurve: StrengthCurvePoint[];
  /** ACI compressive→tensile preset */
  tensilePreset: TensilePreset;
  /** ACI coefficient C in f_t = C·√f'c (psi) */
  tensileCoeff: number;
};

export type SlabLayoutForm = {
  thickness: number | '';    // canonical internal units: inches
  jointSpacing: number | ''; // canonical internal units: feet
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
