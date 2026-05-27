<script lang="ts">
  import {
    unitSystem,
    toDisplayThickness, fromDisplayThickness, thicknessUnit, thicknessStep, thicknessPlaceholder,
    toDisplaySpacing, fromDisplaySpacing, spacingUnit, spacingStep, spacingPlaceholder,
    inputDp, valueDp
  } from '$lib/stores/units';
  import { slabLayout, updateSlabLayout } from '$lib/stores/form';
  import { buildWholeHours } from '$lib/utils/time';
  import type { UnitSystem } from '$lib/types';

  const HOURS = buildWholeHours();
  const JOINT_TYPES = ['Aggregate Interlock', 'Aggregate Interlock with Dowels'] as const;

  let sys: UnitSystem;
  $: sys = $unitSystem;

  // Track the decimal precision the user last typed for each field.
  // Initialized from the canonical value so restored sessions display correctly.
  let thicknessDp = (() => { const v = $slabLayout.thickness; return v === '' ? 0 : valueDp(v); })();
  let spacingDp   = (() => { const v = $slabLayout.jointSpacing; return v === '' ? 0 : valueDp(v); })();

  let thicknessVal: number | '' = '';
  let spacingVal: number | '' = '';

  $: {
    const v = $slabLayout.thickness;
    thicknessVal = v === '' ? '' : parseFloat(toDisplayThickness(v as number, sys).toFixed(thicknessDp));
  }
  $: {
    const v = $slabLayout.jointSpacing;
    spacingVal = v === '' ? '' : parseFloat(toDisplaySpacing(v as number, sys).toFixed(spacingDp));
  }

  // Track which system each field was last manually entered in.
  // When it differs from the current system, show a conversion note.
  let thicknessEnteredInSys: UnitSystem | null = null;
  let spacingEnteredInSys: UnitSystem | null = null;

  $: thicknessConverted = thicknessEnteredInSys !== null && thicknessEnteredInSys !== sys && $slabLayout.thickness !== '';
  $: spacingConverted   = spacingEnteredInSys   !== null && spacingEnteredInSys   !== sys && $slabLayout.jointSpacing !== '';

  function sysLabel(s: UnitSystem): string { return s === 'us' ? 'Imperial' : 'Metric'; }

  function onThicknessChange(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    if (raw !== '') thicknessDp = inputDp(raw);
    thicknessEnteredInSys = sys;
    const asNum = raw === '' ? '' : Number(raw);
    const canonical = asNum === '' ? '' : fromDisplayThickness(asNum as number, sys);
    updateSlabLayout({ thickness: canonical as number | '' });
  }

  function onSpacingChange(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    if (raw !== '') spacingDp = inputDp(raw);
    spacingEnteredInSys = sys;
    const asNum = raw === '' ? '' : Number(raw);
    const canonical = asNum === '' ? '' : fromDisplaySpacing(asNum as number, sys);
    updateSlabLayout({ jointSpacing: canonical as number | '' });
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-1">
    <label class="font-medium" for="slab-thickness">
      Slab Thickness ({thicknessUnit(sys)})
    </label>
    <input
      id="slab-thickness"
      type="number"
      class="border rounded-lg p-2"
      value={thicknessVal}
      min="0"
      step={thicknessStep(sys)}
      placeholder={thicknessPlaceholder(sys)}
      inputmode="decimal"
      on:change={onThicknessChange} />
    {#if thicknessConverted}
      <p class="text-xs text-red-600">Value automatically converted from {sysLabel(thicknessEnteredInSys as UnitSystem)} system; may contain some conversion error.</p>
    {/if}
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium" for="joint-spacing">
      Joint Spacing ({spacingUnit(sys)})
    </label>
    <input
      id="joint-spacing"
      type="number"
      class="border rounded-lg p-2"
      value={spacingVal}
      min="0"
      step={spacingStep(sys)}
      placeholder={spacingPlaceholder(sys)}
      inputmode="decimal"
      on:change={onSpacingChange} />
    {#if spacingConverted}
      <p class="text-xs text-red-600">Value automatically converted from {sysLabel(spacingEnteredInSys as UnitSystem)} system; may contain some conversion error.</p>
    {/if}
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium" for="saw-cut-hour">Expected Saw Cutting Time</label>
    <select
      id="saw-cut-hour"
      class="border rounded-lg p-2"
      bind:value={$slabLayout.sawCutHour}>
      <option value="" disabled selected>Select hour…</option>
      {#each HOURS as h}
        <option value={h.value}>{h.label}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium" for="joint-type">Joint Type</label>
    <select
      id="joint-type"
      class="border rounded-lg p-2"
      bind:value={$slabLayout.jointType}>
      {#each JOINT_TYPES as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium" for="base-type">Base Type</label>
    <input
      id="base-type"
      class="border rounded-lg p-2 bg-gray-50 text-gray-700"
      bind:value={$slabLayout.baseType}
      readonly
      aria-readonly="true" />
  </div>
</div>
