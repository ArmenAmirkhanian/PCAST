<script lang="ts">
  // Shared with the PDF report so the two can never disagree — see
  // $lib/content/legal.ts.
  import {
    DISCLAIMER_PARAGRAPHS_WEB,
    ORIGINAL_WORK,
    ORIGINAL_CONTRIBUTORS,
    WEBAPP_DEVELOPMENT,
    FUNDING_ACKNOWLEDGMENT
  } from '$lib/content/legal';
  // Version numbers are maintained in one place and read from there by both
  // this tab and the PDF report — see $lib/version.ts.
  import {
    APP_VERSION,
    CALC_VERSION,
    CALC_VERSION_DATE,
    CALC_MODULE_LIST,
    CALC_CHANGELOG,
    formatVersionDate
  } from '$lib/version';
  import { BUILD_ID } from '$lib/build-info';
</script>

<div class="space-y-6 max-w-3xl">
  <section>
    <h2 class="text-xl font-semibold mb-2">About PCAST</h2>
    <p class="text-gray-700 leading-relaxed">
      The Pavement Cracking Analysis and Stress Tool (PCAST) is a web-based application
      for evaluating early-age thermal and shrinkage cracking in concrete pavements.
      The software models hydration-driven temperature development, environmental
      boundary conditions, and the resulting stress state within a pavement slab to
      estimate cracking potential during the curing period.
    </p>

    <p>
      The source code to this webapp can be found here: <a href="https://github.com/ArmenAmirkhanian/PCAST" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">GitHub Repository</a>
    </p>

    <p>
      The 30-year climate normal dataset from NOAA, transformed to work with this webapp, can be found here: <a href="https://doi.org/10.57967/hf/8418" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">10.57967/hf/8418</a>
    </p>

    <p>
      The source code used to perform the climate normal transformation can be found here: <a href="https://github.com/ArmenAmirkhanian/ClimateNormalsIngestor" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">GitHub Repository</a>
    </p>

    <p>
      For a construction start date of today or tomorrow, the Environment tab can instead draw a
      live 72-hour hourly forecast from the NOAA National Weather Service gridded forecast API: <a href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">api.weather.gov</a>.
      Unlike the climate normals, a forecast is a single predicted realisation for a specific day
      and is only valid for the issuance time recorded with the analysis.
    </p>
  </section>

  <!-- Version and calculation provenance. A report filed years ago has to be
       traceable to the calculations that produced it, so the same numbers
       printed on the report are shown here. -->
  <section>
    <h2 class="text-xl font-semibold mb-2">Version and Calculation Provenance</h2>

    <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-gray-700 mb-4">
      <dt class="font-medium">Application version</dt>
      <dd>v{APP_VERSION}</dd>
      <dt class="font-medium">Calculation version</dt>
      <dd>v{CALC_VERSION}, effective {formatVersionDate(CALC_VERSION_DATE)}</dd>
      <dt class="font-medium">Build</dt>
      <dd class="font-mono text-sm">{BUILD_ID}</dd>
    </dl>

    <p class="text-gray-700 leading-relaxed mb-3">
      The calculation version identifies the design methodology used to produce results. It changes
      only when a computed result can change — a formula, coefficient, default, or numerical scheme.
      Every generated PDF report records the calculation version and the versions of the individual
      analyses it ran, so a filed report can always be matched to the methodology behind it.
      Reports produced by different calculation versions are not directly comparable.
    </p>

    <h3 class="font-semibold mb-2">Calculation Modules</h3>
    <div class="overflow-x-auto mb-4">
      <table class="w-full text-sm text-left border-collapse">
        <thead>
          <tr class="border-b border-gray-300">
            <th class="py-1 pr-4 font-semibold">Analysis</th>
            <th class="py-1 pr-4 font-semibold whitespace-nowrap">Version</th>
            <th class="py-1 pr-4 font-semibold whitespace-nowrap">Effective</th>
            <th class="py-1 font-semibold">Basis</th>
          </tr>
        </thead>
        <tbody>
          {#each CALC_MODULE_LIST as m}
            <tr class="border-b border-gray-200 align-top">
              <td class="py-1 pr-4">{m.label}</td>
              <td class="py-1 pr-4 whitespace-nowrap">v{m.version}</td>
              <td class="py-1 pr-4 whitespace-nowrap">{formatVersionDate(m.date)}</td>
              <td class="py-1 text-gray-600">
                {m.basis}
                <span class="block font-mono text-xs text-gray-500">{m.source}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <h3 class="font-semibold mb-2">Calculation Change History</h3>
    <div class="space-y-3">
      {#each CALC_CHANGELOG as entry}
        <div>
          <p class="font-medium text-gray-800">
            v{entry.version} — {formatVersionDate(entry.date)}
            {#if entry.modules.length}
              <span class="font-normal text-gray-500 text-sm">
                ({entry.modules.join(', ')})
              </span>
            {/if}
          </p>
          <p class="text-gray-700">{entry.summary}</p>
          <ul class="list-disc list-inside space-y-1 text-gray-600 text-sm">
            {#each entry.changes as change}
              <li>{change}</li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </section>

  <section>
    <h2 class="text-xl font-semibold mb-2">Original Work</h2>
    <p class="text-gray-700 leading-relaxed mb-3">
      {ORIGINAL_WORK.before}<em>{ORIGINAL_WORK.emphasis}</em>{ORIGINAL_WORK.after}
    </p>

    <p class="text-gray-700 mb-3">
      Original contributors include:
    </p>

    <ul class="list-disc list-inside space-y-1 text-gray-700">
      {#each ORIGINAL_CONTRIBUTORS as name}
        <li>{name}</li>
      {/each}
    </ul>
  </section>

  <section>
    <h2 class="text-xl font-semibold mb-2">Web Application Development</h2>
    <p class="text-gray-700 leading-relaxed">{WEBAPP_DEVELOPMENT}</p>
  </section>

  <section>
    <h2 class="text-xl font-semibold mb-2">Funding Acknowledgment</h2>
    <p class="text-gray-700 leading-relaxed">{FUNDING_ACKNOWLEDGMENT}</p>
  </section>

  <section>
    <h2 class="text-xl font-semibold mb-2">Disclaimer</h2>
    {#each DISCLAIMER_PARAGRAPHS_WEB as para}
      <p class="text-gray-700 leading-relaxed mb-3">{para}</p>
    {/each}
  </section>
</div>
