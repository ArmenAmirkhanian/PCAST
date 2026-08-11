<script lang="ts">
  import { projectInfo, updateProjectInfo } from '$lib/stores/form';
  import { get } from 'svelte/store';
  import { isForecastEligible, localTodayISO } from '$lib/utils/time';
  // Local calendar date, not `toISOString()` — the UTC date is already
  // tomorrow for a US user in the evening, which would both offer an
  // out-of-range minimum and misjudge forecast eligibility.
  const todayISO = localTodayISO();
  let value = get(projectInfo).date || todayISO;
  function onChange(e: Event) {
    value = (e.target as HTMLInputElement).value;
    updateProjectInfo({ date: value });
  }
  $: forecastAvailable = isForecastEligible($projectInfo.date);
</script>

<div class="flex flex-col gap-1">
  <label class="font-medium">Date</label>
  <input class="border rounded-lg p-2" type="date" min={todayISO} bind:value={value} on:change={onChange} />
  <p class="text-xs {forecastAvailable ? 'text-green-700' : 'text-gray-500'}">
    {#if forecastAvailable}
      Live NOAA 72-hour forecast is available for this date — select it on the Environment tab.
    {:else}
      Choose today or tomorrow to unlock the live NOAA 72-hour forecast on the Environment tab.
    {/if}
  </p>
</div>
