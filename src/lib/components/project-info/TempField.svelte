<script lang="ts">
  import { unitSystem, tempUnit, toDisplayTemp, fromDisplayTemp, tempMin, tempMax, tempStep } from '$lib/stores/units';
  import { projectInfo, updateProjectInfo } from '$lib/stores/form';
  import type { ProjectInfoForm, UnitSystem } from '$lib/types';

  export let label = 'Temperature';
  export let keyF: keyof Pick<ProjectInfoForm, 'startTempF'|'deliveryTempF'> = 'startTempF';

  let sys: string;
  $: sys = $unitSystem;

  // Re-derives when either the store value or the unit system changes.
  let uiVal: string | number = '';
  $: {
    const v = $projectInfo[keyF];
    uiVal = v === '' ? '' : Math.round(toDisplayTemp(v as number, sys as any));
  }

  // Track which system this field was last manually entered in.
  let enteredInSys: UnitSystem | null = null;
  $: converted = enteredInSys !== null && enteredInSys !== sys && $projectInfo[keyF] !== '';

  function sysLabel(s: UnitSystem): string { return s === 'us' ? 'Imperial' : 'Metric'; }

  function onChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    const asNum = v === '' ? '' : Number(v);
    const next = asNum === '' ? '' : Math.round(fromDisplayTemp(asNum as number, sys as any));
    enteredInSys = sys as UnitSystem;
    updateProjectInfo({ [keyF]: next } as any);
  }
</script>

<div class="flex flex-col gap-1">
  <label class="font-medium" for={keyF}>{label} ({$tempUnit})</label>
  <input id={keyF} class="border rounded-lg p-2" type="number"
         placeholder={sys === 'us' ? 'e.g., 72' : 'e.g., 22'}
         min={tempMin(sys as any)} max={tempMax(sys as any)} step={tempStep(sys as any)}
         bind:value={uiVal} on:change={onChange} />
  {#if converted}
    <p class="text-xs text-red-600">Value automatically converted from {sysLabel(enteredInSys as UnitSystem)} system; may contain some conversion error.</p>
  {/if}
</div>
