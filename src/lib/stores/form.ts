import { writable } from 'svelte/store';
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation } from '$lib/types';

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
  curing: 'Curing Compound'
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