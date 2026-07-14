import { writable } from 'svelte/store';
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation } from '$lib/types';
import type { HydrationModel } from '$lib/types';
import type { ModelOutput } from '$lib/models/illitherm/types';
import type { StressOutput, CreepModel } from '$lib/models/stress/types';

const todayISO = new Date().toISOString().slice(0, 10);

export const projectInfo = writable<ProjectInfoForm>({
  state: '',
  city: '',
  date: todayISO,
  startHour: '',
  startTempF: '',
  deliveryTempF: ''
});

// convenience setter
export function updateProjectInfo(patch: Partial<ProjectInfoForm>) {
  projectInfo.update((f) => ({ ...f, ...patch }));
}

export const materials = writable<MaterialsForm>({
  cementType: 'Type I/II',
  scm: 'None',
  waterCementRatio: '',
  curing: 'Curing Compound',
  hydrationModel: null,
  hydrationModelInputs: {},
  strengthInputMode: 'fc28',
  fc28Psi: '',
  strengthCurve: [
    { ageDays: '', fcPsi: '' },
    { ageDays: '', fcPsi: '' },
    { ageDays: '', fcPsi: '' }
  ],
  tensilePreset: 'mor',
  tensileCoeff: 7.5
});

export function updateMaterials(patch: Partial<MaterialsForm>) {
  materials.update((m) => ({ ...m, ...patch }));
}

export const slabLayout = writable<SlabLayoutForm>({
  thickness: '',
  jointSpacing: '',
  sawCutHour: '',
  jointType: 'Aggregate Interlock',
  baseType: 'Granular'
});

export function updateSlabLayout(patch: Partial<SlabLayoutForm>) {
  slabLayout.update((s) => ({ ...s, ...patch }));
}

export const weatherStations = writable<WeatherStation[]>([]);

export const chartImages = writable<{
  temp: string;
  wind: string;
  cloud: string;
}>({
  temp: '',
  wind: '',
  cloud: ''
});

export const hydrationModelResults = writable<Partial<Record<HydrationModel, Record<string, number>>>>({});

export type BentzPoint = { t: number; alpha: number };
export const bentzSeries = writable<BentzPoint[] | null>(null);

export type MaturityPoint = {
  hour: number;
  equivalentAge: number;
  degreeOfHydration: number;
  heatOfHydration: number;
  /** Tensile strength (psi) when compressive input supplied, else KIC strength */
  strength: number;
  /** Age-appropriate compressive strength (psi); present only with f'c input */
  compressiveStrength?: number;
};
export const maturityResultsStore = writable<MaturityPoint[] | null>(null);

export type WeatherHourlyRow = {
  offsetHr: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  airTempC: number;
  windMps: number;
  cloudPct: number | null;
};

export const weatherHourlyData = writable<WeatherHourlyRow[]>([]);
export const thermalGradientResults = writable<ModelOutput | null>(null);

// ---------------------------------------------------------------------------
// Stress & creep analysis
// ---------------------------------------------------------------------------

/**
 * User-editable parameters for the stress & creep analysis that are not
 * captured elsewhere in the app. Canonical (US/Imperial) units.
 */
export type StressParamsForm = {
  /** Poisson's ratio (dimensionless) */
  poissonRatio: number;
  /** Coefficient of thermal expansion (1/°F) */
  coteF: number;
  /** Modulus of subgrade reaction k (psi/in) */
  kValue: number;
  /** Horizontal slab-base restraint coefficient (psi/in) */
  frictionCoefficient: number;
  /** Fully-hydrated / 28-day elastic modulus (psi) */
  matureModulusPsi: number;
  /** Normalised sawcut depth α = a/h (0–1); empty = free joint */
  sawcutNormalized: number | '';
  /** Creep coefficient multiplier a1 */
  creepA1: number;
  /** Bounded aging-modulus model that feeds the creep compliance kernel */
  creepModel: CreepModel;
  /** Aging coefficient χ for the AEMM model (Trost/Bažant; 0.6–0.9) */
  agingCoefficient: number;
  /** CEB-FIP/EC2 cement-type coefficient s (rapid 0.20 / normal 0.25 / slow 0.38) */
  cebFipS: number;
};

export const DEFAULT_STRESS_PARAMS: StressParamsForm = {
  poissonRatio:        0.15,
  coteF:               5.5e-6,
  kValue:              200,
  frictionCoefficient: 1.5,
  matureModulusPsi:    4_000_000,
  sawcutNormalized:    0.25,
  creepA1:             1,
  creepModel:          'hydration',
  agingCoefficient:    0.8,
  cebFipS:             0.25,
};

export const stressParams = writable<StressParamsForm>({ ...DEFAULT_STRESS_PARAMS });

export function updateStressParams(patch: Partial<StressParamsForm>) {
  stressParams.update((s) => ({ ...s, ...patch }));
}

export const stressResults = writable<StressOutput | null>(null);