import { writable } from 'svelte/store';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation } from '$lib/types';
=======
import type { ProjectInfoForm, MaterialsForm } from '$lib/types';
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm } from '$lib/types';
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation } from '$lib/types';
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation, StationDisplayData } from '$lib/types';
>>>>>>> 4d385f5 (User interface updates: Appendix A weather station tables and input placeholder fix)
=======
import type { ProjectInfoForm, MaterialsForm } from '$lib/types';
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm } from '$lib/types';
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation } from '$lib/types';
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm } from '$lib/types';
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm } from '$lib/types';
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation } from '$lib/types';
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm } from '$lib/types';
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm } from '$lib/types';
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
import type { ProjectInfoForm, MaterialsForm, SlabLayoutForm, WeatherStation } from '$lib/types';
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)

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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
}

export const weatherStations = writable<WeatherStation[]>([]);

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
export const stationDisplays = writable<StationDisplayData[]>([]);

=======
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
export const chartImages = writable<{
  temp: string;
  wind: string;
  cloud: string;
}>({
  temp: '',
  wind: '',
  cloud: ''
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
});
=======
}
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
}
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
}

export const weatherStations = writable<WeatherStation[]>([]);
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
});
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
}
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
}
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
}

export const weatherStations = writable<WeatherStation[]>([]);
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
});
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
}
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
}
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
}

export const weatherStations = writable<WeatherStation[]>([]);
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
});
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
=======
}
>>>>>>> 1c27bc7 (Add Materials section to Report PDF)
=======
}
>>>>>>> fa18172 (Add Slab Layout section to Report PDF)
=======
}

export const weatherStations = writable<WeatherStation[]>([]);
>>>>>>> 17e3f7e (Add Environment section with weather station data to Report PDF)
=======
});
>>>>>>> 9e24379 (Add 72-hour Plotly charts to Report PDF Environment section)
