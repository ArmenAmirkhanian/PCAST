<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const CEMENT_TYPES = ['Type I/II', 'Type I/II with 5% limestone'] as const;
  const SCM_OPTIONS = ['None', '25% C Ash', '25% F ash', '25% slag'] as const;
  const CURING_OPTIONS = ['Curing Compound', 'No Curing Compound'] as const;

  export let cementType: (typeof CEMENT_TYPES)[number] = CEMENT_TYPES[0];
  export let scm: (typeof SCM_OPTIONS)[number] = SCM_OPTIONS[0];
  export let waterCementRatio: number | '' = '';
  export let curing: (typeof CURING_OPTIONS)[number] = CURING_OPTIONS[0];

  const dispatch = createEventDispatcher<{
    change: {
      cementType: (typeof CEMENT_TYPES)[number];
      scm: (typeof SCM_OPTIONS)[number];
      waterCementRatio: number | '';
      curing: (typeof CURING_OPTIONS)[number];
    }
  }>();

  function emit() {
    dispatch('change', { cementType, scm, waterCementRatio, curing });
  }

  function handleWaterChange(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    waterCementRatio = raw === '' ? '' : Number(raw);
    emit();
  }

  function handleSelectChange(event: Event, field: 'cement' | 'scm') {
    const value = (event.target as HTMLSelectElement).value;
    if (field === 'cement') cementType = value as (typeof CEMENT_TYPES)[number];
    if (field === 'scm') scm = value as (typeof SCM_OPTIONS)[number];
    emit();
  }

  function handleCuringChange(event: Event) {
    curing = (event.target as HTMLInputElement).value as (typeof CURING_OPTIONS)[number];
    emit();
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-1">
    <label class="font-medium">Cement Type</label>
    <select
      class="border rounded-lg p-2"
      bind:value={cementType}
      on:change={(e) => handleSelectChange(e, 'cement')}>
      {#each CEMENT_TYPES as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">SCM</label>
    <select
      class="border rounded-lg p-2"
      bind:value={scm}
      on:change={(e) => handleSelectChange(e, 'scm')}>
      {#each SCM_OPTIONS as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">w/c (m)</label>
    <input
      class="border rounded-lg p-2"
      type="number"
      min="0.37"
      max="0.45"
      step="0.01"
      placeholder="0.40"
      bind:value={waterCementRatio}
      on:input={handleWaterChange}
      inputmode="decimal" />
    <p class="text-xs text-gray-600">Allowed range: 0.37 - 0.45</p>
  </div>

  <div class="flex flex-col gap-2">
    <label class="font-medium">Curing</label>
    <div class="flex flex-wrap gap-4">
      {#each CURING_OPTIONS as option}
        <label class="flex items-center gap-2">
          <input
            type="radio"
            name="curing"
            value={option}
            checked={curing === option}
            on:change={handleCuringChange} />
          <span>{option}</span>
        </label>
      {/each}
    </div>
  </div>
</div>
