<script lang="ts">
  import { unitSystem, tempUnit, toDisplayTemp, fromDisplayTemp, tempMin, tempMax, tempStep } from '$lib/stores/units';
  import { projectInfo, updateProjectInfo } from '$lib/stores/form';
  import type { ProjectInfoForm } from '$lib/types';
  import { get } from 'svelte/store';

  export let label = 'Temperature';
  export let keyF: keyof Pick<ProjectInfoForm, 'startTempF'|'deliveryTempF'> = 'startTempF';

  let sys = 'us';
  unitSystem.subscribe(v => sys = v);

  // derive UI value from canonical °F store
  function currentF(): number|'' { return get(projectInfo)[keyF]; }
  function currentUI(): string|number {
    const v = currentF();
    return v === '' ? '' : Math.round(toDisplayTemp(v as number, sys as any));
  }

  let uiVal: string|number = currentUI();
  $: uiVal = currentUI();

  function onChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    const asNum = v === '' ? '' : Number(v);
    const next = asNum === '' ? '' : Math.round(fromDisplayTemp(asNum as number, sys as any));
    // update proper key
    updateProjectInfo({ [keyF]: next } as any);
  }
</script>

<div class="flex flex-col gap-1">
  <label class="font-medium">{label} ({$tempUnit})</label>
  <input class="border rounded-lg p-2" type="number"
         placeholder={sys === 'us' ? 'e.g., 72' : 'e.g., 22'}
         min={tempMin(sys as any)} max={tempMax(sys as any)} step={tempStep(sys as any)}
         bind:value={uiVal} on:change={onChange} />
</div>