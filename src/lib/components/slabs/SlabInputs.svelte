<script lang="ts">
  import { unitSystem } from '$lib/stores/units';
  import { slabLayout } from '$lib/stores/form';
  import { buildWholeHours } from '$lib/utils/time';
  import type { UnitSystem } from '$lib/types';

  const HOURS = buildWholeHours();
  const JOINT_TYPES = ['Aggregate Interlock', 'Aggregate Interlock with Dowels'] as const;

  let system: UnitSystem;
  $: system = $unitSystem;
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-1">
    <label class="font-medium">
      Slab Thickness ({system === 'us' ? 'in' : 'mm'})
    </label>
    <input
      type="number"
      class="border rounded-lg p-2"
      bind:value={$slabLayout.thickness}
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
      bind:value={$slabLayout.jointSpacing}
      min="0"
      step="0.1"
      placeholder={system === 'us' ? 'e.g., 15' : 'e.g., 4.5'}
      inputmode="decimal" />
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">Expected Saw Cutting Time</label>
    <select
      class="border rounded-lg p-2"
      bind:value={$slabLayout.sawCutHour}>
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
      bind:value={$slabLayout.jointType}>
      {#each JOINT_TYPES as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">Base Type</label>
    <input
      class="border rounded-lg p-2 bg-gray-50 text-gray-700"
      bind:value={$slabLayout.baseType}
      readonly
      aria-readonly="true" />
  </div>
</div>
