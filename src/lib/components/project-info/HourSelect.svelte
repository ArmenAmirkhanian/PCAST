<script lang="ts">
  import { projectInfo, updateProjectInfo } from '$lib/stores/form';
  import { get } from 'svelte/store';
  import { buildWholeHours } from '$lib/utils/time';
  const HOURS = buildWholeHours();
  let value = get(projectInfo).startHour;
  function onChange(e: Event) {
    value = (e.target as HTMLSelectElement).value;
    updateProjectInfo({ startHour: value });
  }
</script>

<div class="flex flex-col gap-1">
  <label class="font-medium">Start Time for Construction</label>
  <select class="border rounded-lg p-2" bind:value={value} on:change={onChange}>
    <option value="" disabled selected>Select hour…</option>
    {#each HOURS as h}
      <option value={h.value}>{h.label}</option>
    {/each}
  </select>
</div>