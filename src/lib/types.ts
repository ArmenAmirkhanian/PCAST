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
