<script lang="ts">
  import { projectInfo, updateProjectInfo } from '$lib/stores/form';
  import { get } from 'svelte/store';
  import { localTodayISO } from '$lib/utils/time';
  // Local calendar date, not `toISOString()` — the UTC date is already
  // tomorrow for a US user in the evening, which would offer an out-of-range
  // minimum.
  const todayISO = localTodayISO();
  let value = get(projectInfo).date || todayISO;
  function onChange(e: Event) {
    value = (e.target as HTMLInputElement).value;
    updateProjectInfo({ date: value });
  }
</script>

<div class="flex flex-col gap-1">
  <label class="font-medium">Date</label>
  <input class="border rounded-lg p-2" type="date" min={todayISO} bind:value={value} on:change={onChange} />
  <p class="text-xs text-gray-500">
    Climate normals cover any date. The Environment tab checks whether NOAA/NWS has issued live
    forecast data reaching over this date, and offers it if so.
  </p>
</div>
