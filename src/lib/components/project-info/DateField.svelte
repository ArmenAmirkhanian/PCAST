<script lang="ts">
  import { projectInfo, updateProjectInfo } from '$lib/stores/form';
  import { get } from 'svelte/store';
  const todayISO = new Date().toISOString().slice(0,10);
  let value = get(projectInfo).date || todayISO;
  function onChange(e: Event) {
    value = (e.target as HTMLInputElement).value;
    updateProjectInfo({ date: value });
  }
</script>

<div class="flex flex-col gap-1">
  <label class="font-medium">Date</label>
  <input class="border rounded-lg p-2" type="date" min={todayISO} bind:value={value} on:change={onChange} />
</div>