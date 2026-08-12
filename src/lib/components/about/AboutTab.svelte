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
