<script lang="ts">
  import StateSelect from './StateSelect.svelte';
  import CityAutocomplete from './CityAutocomplete.svelte';
  import DateField from './DateField.svelte';
  import HourSelect from './HourSelect.svelte';
  import TempField from './TempField.svelte';
  import MapView from './MapView.svelte';
  import { site, allPoints } from '$lib/stores/stations';
  import { projectInfo } from '$lib/stores/form';
  import type { PlacesIndex } from '$lib/types';

  // parent passes placesIndex (prebuilt) down to CityAutocomplete
  export let placesIndex: PlacesIndex = {};

  $: selected = (() => {
    if (!$projectInfo.state || !$projectInfo.city) return null;
    return (placesIndex[$projectInfo.state] || []).find(
      (p) => p.city.toLowerCase() === $projectInfo.city.toLowerCase()
    ) || null;
  })();

  const formatCoord = (value: number | null) => value === null ? '' : value.toFixed(4);
</script>

<div class="space-y-6">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <StateSelect />
    <CityAutocomplete {placesIndex} />
    <div class="flex flex-col gap-1">
      <label class="font-medium">Latitude</label>
      <input
        class="border rounded-lg p-2 bg-gray-50 text-gray-700"
        value={formatCoord(selected?.latitude ?? null)}
        readonly
        aria-readonly="true"
        placeholder="Select a city" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="font-medium">Longitude</label>
      <input
        class="border rounded-lg p-2 bg-gray-50 text-gray-700"
        value={formatCoord(selected?.longitude ?? null)}
        readonly
        aria-readonly="true"
        placeholder="Select a city" />
    </div>
    <DateField />
    <HourSelect />
    <TempField label="Construction Start Temperature" keyF="startTempF" />
    <TempField label="Concrete Delivery Temperature" keyF="deliveryTempF" />
  </div>

  <div class="space-y-2">
    <h3 class="text-lg font-semibold">Project Map</h3>
    <MapView center={$site} points={$allPoints} />
  </div>
</div>
