<script lang="ts">
  import StateSelect from './StateSelect.svelte';
  import CityAutocomplete from './CityAutocomplete.svelte';
  import DateField from './DateField.svelte';
  import HourSelect from './HourSelect.svelte';
  import TempField from './TempField.svelte';

  // parent passes placesIndex (prebuilt) down to CityAutocomplete
  export let placesIndex: Record<string, string[]> = {};
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <StateSelect />
  <CityAutocomplete {placesIndex} />
  <DateField />
  <HourSelect />
  <TempField label="Construction Start Temperature" keyF="startTempF" />
  <TempField label="Concrete Delivery Temperature" keyF="deliveryTempF" />
</div>