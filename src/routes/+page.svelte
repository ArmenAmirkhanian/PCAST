<script lang="ts">
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import ProjectInfoTab from '$lib/components/project-info/ProjectInfoTab.svelte';
  import { unitSystem } from '$lib/stores/units';
  import { projectInfo } from '$lib/stores/form';
  import placesIndex from '$lib/data/places-index.json';
	import SlabInputs from '$lib/components/slabs/SlabInputs.svelte';
	import MaterialsInput from '$lib/components/materials/MaterialsInput.svelte';
	import EnvTab from '$lib/components/environmental/envTab.svelte';
import ReportPdfTab from '$lib/components/report/ReportPdfTab.svelte';
import HydrationPlotsTab from '$lib/components/materials/HydrationPlotsTab.svelte';
import TemperatureGradientChart from '$lib/components/results/TemperatureGradientChart.svelte';
import StressAnalysisTab from '$lib/components/analysis/StressAnalysisTab.svelte';
import AboutTab from '$lib/components/about/AboutTab.svelte';
  import { APP_VERSION, CALC_VERSION, CALC_VERSION_DATE, formatVersionDate } from '$lib/version';

  export let data: {
    explanations: {
      haversineApprox: string;
      climateNormals: string;
      liveForecast: string;
    };
    hydrationModelEquations: Record<string, string>;
    analysisNarratives: Record<string, string>;
  };

  let system: 'us'|'metric' = 'us';
  $: unitSystem.set(system);

  const sections = [
    { id: 'project',    label: 'Project Info' },
    { id: 'materials',  label: 'Materials' },
    { id: 'hydration',  label: 'Hydration' },
    { id: 'slabs',      label: 'Slab Layout' },
    { id: 'environment', label: 'Environment' },
    { id: 'results',    label: 'Results' },
    { id: 'analysis',   label: 'Analysis' },
    { id: 'report',     label: 'Report PDF' },
    { id: 'about',      label: 'About' }
  ];
</script>

<div class="mx-auto max-w-5xl p-4">
  <div class="flex items-center justify-between mb-4">
    <div>
      <h1 class="text-2xl font-bold">Pavement Cracking Tool</h1>
      <!-- Which calculations produced what is on screen. Full provenance,
           including the per-module versions and the change history, is on the
           About tab; see $lib/version.ts. -->
      <p class="text-xs text-gray-500">
        v{APP_VERSION} · calculations v{CALC_VERSION} ({formatVersionDate(CALC_VERSION_DATE)}) ·
        <a href="#about" class="underline hover:text-gray-700">version details</a>
      </p>
    </div>
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
    <div class:hidden={active !== 'project'}>
      <ProjectInfoTab {placesIndex} />
    </div>
    <div class:hidden={active !== 'materials'}>
      <MaterialsInput hydrationModelEquations={data.hydrationModelEquations} />
    </div>
    <div class:hidden={active !== 'hydration'}>
      <HydrationPlotsTab />
    </div>
    <div class:hidden={active !== 'slabs'}>
      <SlabInputs />
    </div>
    <div class:hidden={active !== 'environment'}>
      <EnvTab
        active={active === 'environment'}
        stationExplanationHtml={data.explanations.haversineApprox}
        climateNormalsHtml={data.explanations.climateNormals}
        liveForecastHtml={data.explanations.liveForecast}
      />
    </div>
    <div class:hidden={active !== 'results'}>
      <TemperatureGradientChart />
    </div>
    <div class:hidden={active !== 'analysis'}>
      <StressAnalysisTab />
    </div>
    <div class:hidden={active !== 'report'}>
      <ReportPdfTab
        hydrationModelEquations={data.hydrationModelEquations}
        analysisNarratives={data.analysisNarratives}
      />
    </div>
    <div class:hidden={active !== 'about'}>
      <AboutTab />
    </div>
  </div>
</Tabs>

</div>
