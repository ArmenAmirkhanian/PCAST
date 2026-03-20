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

export type HydrationModel = 'bentz' | 'schindler-folliard' | 'knudsen-linear' | 'knudsen-parabolic' | 'lam';

export type MaterialsForm = {
  cementType: 'Type I/II' | 'Type I/II with 5% limestone';
  scm: 'None' | '25% C Ash' | '25% F ash' | '25% slag';
  waterCementRatio: number | '';
  curing: 'Curing Compound' | 'No Curing Compound';
  hydrationModel: HydrationModel | null;
  hydrationModelInputs: Record<string, number | ''>;
};
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)

export type SlabLayoutForm = {
  thickness: number | '';
  jointSpacing: number | '';
  sawCutHour: string;
  jointType: 'Aggregate Interlock' | 'Aggregate Interlock with Dowels';
  baseType: string;
};
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)

export type WeatherStation = {
  stationId: number;
  ghcnId: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  distanceKm: number;
};
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======

export type HourlyRow = {
  offsetHr: number;
  month: number;
  day: number;
  hour: number;
  temp: number | null;
  cloud: number | null;
  wind: number | null;
};

export type StationDisplayData = WeatherStation & {
  hourly: HourlyRow[];
};
>>>>>>> 4d385f5 (User interface updates: Appendix A weather station tables and input placeholder fix)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
