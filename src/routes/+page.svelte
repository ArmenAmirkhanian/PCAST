<script lang="ts">
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import ProjectInfoTab from '$lib/components/project-info/ProjectInfoTab.svelte';
  import { unitSystem } from '$lib/stores/units';
  import { projectInfo } from '$lib/stores/form';
  import placesIndex from '$lib/data/places-index.json';
	import SlabInputs from '$lib/components/slabs/SlabInputs.svelte';

  let system: 'us'|'metric' = 'us';
  $: unitSystem.set(system);

  const sections = [
    { id: 'project', label: 'Project Info' },
    { id: 'materials', label: 'Materials' },
    { id: 'slabs', label: 'Slab Layout' },
    { id: 'environment', label: 'Environment' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'results', label: 'Results' }
  ];
</script>

<div class="mx-auto max-w-5xl p-4">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold">Pavement Cracking Tool</h1>
    <div class="flex items-center gap-2">
      <label class="font-medium">Units</label>
      <select class="border rounded-lg p-2" bind:value={system}>
        <option value="us">US (Imperial)</option>
        <option value="metric">Metric (SI)</option>
      </select>
    </div>
  </div>

  <Tabs tabs={sections} useHash={true}>
  <div slot="panels" class="mt-4" let:active>
    {#if active === 'project'}
      <ProjectInfoTab {placesIndex} />
    {:else if active === 'materials'}
      <p class="text-gray-600">Materials tab coming soon…</p>
    {:else if active === 'slabs'} 
      <SlabInputs />
    {:else if active === 'environment'}
      <p class="text-gray-600">Environment tab coming soon…</p>
    {:else if active === 'analysis'}
      <p class="text-gray-600">Analysis tab coming soon…</p>
    {:else if active === 'results'}
      <p class="text-gray-600">Results tab coming soon…</p>
    {/if}
  </div>
</Tabs>


  <details class="mt-6">
    <summary class="cursor-pointer font-medium">Debug: Form State</summary>
    <pre class="text-xs bg-gray-50 border rounded p-3 overflow-auto">
{JSON.stringify($projectInfo, null, 2)}
</pre>
  </details>
</div>
