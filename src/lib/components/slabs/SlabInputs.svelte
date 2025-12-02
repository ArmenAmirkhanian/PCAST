<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { unitSystem } from '$lib/stores/units';
  import { buildWholeHours } from '$lib/utils/time';
  import type { UnitSystem } from '$lib/types';

  const HOURS = buildWholeHours();
  const JOINT_TYPES = ['Aggregate Interlock', 'Aggregate Interlock with Dowels'] as const;

  export let thickness: number | '' = '';
  export let jointSpacing: number | '' = '';
  export let sawCutHour: string = '';
  export let jointType: (typeof JOINT_TYPES)[number] = JOINT_TYPES[0];
  export let baseType: string = 'Granular';

  const dispatch = createEventDispatcher<{
    change: {
      thickness: number | '';
      jointSpacing: number | '';
      sawCutHour: string;
      jointType: string;
      baseType: string;
    }
  }>();

  let system: UnitSystem;
  $: system = $unitSystem;

  function emit() {
    dispatch('change', { thickness, jointSpacing, sawCutHour, jointType, baseType });
  }

  function handleNumberInput(event: Event, field: 'thickness' | 'jointSpacing') {
    const raw = (event.target as HTMLInputElement).value;
    const val = raw === '' ? '' : Number(raw);
    if (field === 'thickness') thickness = val;
    if (field === 'jointSpacing') jointSpacing = val;
    emit();
  }

  function handleSawCutChange(event: Event) {
    sawCutHour = (event.target as HTMLSelectElement).value;
    emit();
  }

  function handleJointTypeChange(event: Event) {
    jointType = (event.target as HTMLSelectElement).value as (typeof JOINT_TYPES)[number];
    emit();
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-1">
    <label class="font-medium">
      Slab Thickness ({system === 'us' ? 'in' : 'mm'})
    </label>
    <input
      type="number"
      class="border rounded-lg p-2"
      bind:value={thickness}
      on:input={(e) => handleNumberInput(e, 'thickness')}
      min="0"
      step="0.1"
      placeholder={system === 'us' ? 'e.g., 8' : 'e.g., 200'}
      inputmode="decimal" />
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">
      Joint Spacing ({system === 'us' ? 'ft' : 'm'})
    </label>
    <input
      type="number"
      class="border rounded-lg p-2"
      bind:value={jointSpacing}
      on:input={(e) => handleNumberInput(e, 'jointSpacing')}
      min="0"
      step="0.1"
      placeholder={system === 'us' ? 'e.g., 15' : 'e.g., 4.5'}
      inputmode="decimal" />
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">Expected Saw Cutting Time</label>
    <select
      class="border rounded-lg p-2"
      bind:value={sawCutHour}
      on:change={handleSawCutChange}>
      <option value="" disabled selected>Select hour…</option>
      {#each HOURS as h}
        <option value={h.value}>{h.label}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">Joint Type</label>
    <select
      class="border rounded-lg p-2"
      bind:value={jointType}
      on:change={handleJointTypeChange}>
      {#each JOINT_TYPES as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">Base Type</label>
    <input
      class="border rounded-lg p-2 bg-gray-50 text-gray-700"
      value={baseType}
      readonly
      aria-readonly="true" />
  </div>
</div>
