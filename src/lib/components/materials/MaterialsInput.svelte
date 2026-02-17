<script lang="ts">
  import { materials } from '$lib/stores/form';

  const CEMENT_TYPES = ['Type I/II', 'Type I/II with 5% limestone'] as const;
  const SCM_OPTIONS = ['None', '25% C Ash', '25% F ash', '25% slag'] as const;
  const CURING_OPTIONS = ['Curing Compound', 'No Curing Compound'] as const;
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-1">
    <label class="font-medium">Cement Type</label>
    <select
      class="border rounded-lg p-2"
      bind:value={$materials.cementType}>
      {#each CEMENT_TYPES as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>

  <div class="flex flex-col gap-1">
    <label class="font-medium">SCM</label>
    <select
      class="border rounded-lg p-2"
      bind:value={$materials.scm}>
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
      bind:value={$materials.waterCementRatio}
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
            bind:group={$materials.curing} />
          <span>{option}</span>
        </label>
      {/each}
    </div>
  </div>
</div>
