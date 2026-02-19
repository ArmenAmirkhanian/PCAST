<script lang="ts">
  import { onMount } from 'svelte';
  import { PUBLIC_MAPTILER_KEY } from '$env/static/public';

  const defaultStyleUrl = PUBLIC_MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets/style.json?key=${PUBLIC_MAPTILER_KEY}`
    : 'https://api.maptiler.com/maps/streets/style.json';

  export let center: [number, number] = [-87.5692, 33.2098];
  export let points: [number, number][] = [];
  export let styleUrl = defaultStyleUrl;

  let el: HTMLDivElement;
  let map: any;
  let mapImageSrc = '';
  let mapLoaded = false;
  let maplibregl: any;

  // Update map when center or points change
  $: if (map && maplibregl && map.loaded()) {
    map.getSource('center-point')?.setData(toCenterFC());
    map.getSource('points')?.setData(toPointsFC());

    const all = [center, ...points].filter(Boolean);
    if (all.length) {
      const b = new maplibregl.LngLatBounds(all[0], all[0]);
      all.forEach((p: [number, number]) => b.extend(p));
      map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 9 });

      // Recapture the map after updating
      map.once('idle', () => {
        setTimeout(() => {
          const canvas = el.querySelector('canvas');
          if (canvas) {
            try {
              mapImageSrc = canvas.toDataURL('image/png');
              mapLoaded = true;
            } catch (err) {
              console.error('Failed to recapture map:', err);
            }
          }
        }, 500);
      });
    }
  }

  function toPointsFC() {
    return {
      type: 'FeatureCollection',
      features: points
        .filter((p) => p[0] !== center?.[0] || p[1] !== center?.[1])
        .map((c, i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: c },
          properties: { idx: i }
        }))
    };
  }

  function toCenterFC() {
    if (!center) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: center },
        properties: { isCenter: true }
      }]
    };
  }

  onMount(async () => {
    maplibregl = (await import('maplibre-gl')).default;
    map = new maplibregl.Map({
      container: el,
      style: styleUrl,
      center,
      zoom: 9,
      interactive: false // Disable all interactions
    });

    map.on('load', () => {
      map.addSource('center-point', { type: 'geojson', data: toCenterFC() });
      map.addSource('points', { type: 'geojson', data: toPointsFC() });

      // Find the first label layer to insert our markers before it
      // This ensures city names and labels appear on top of our dots
      const layers = map.getStyle().layers;
      let firstLabelLayerId: string | undefined;
      for (const layer of layers) {
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
          firstLabelLayerId = layer.id;
          break;
        }
      }

      map.addLayer({
        id: 'center-circle',
        type: 'circle',
        source: 'center-point',
        paint: {
          'circle-radius': 9,
          'circle-color': '#2563eb',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3
        }
      }, firstLabelLayerId);

      map.addLayer({
        id: 'points-circles',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': 6,
          'circle-color': '#e53935',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2
        }
      }, firstLabelLayerId);

      const all = [center, ...points].filter(Boolean);
      if (all.length) {
        const b = new maplibregl.LngLatBounds(all[0], all[0]);
        all.forEach(p => b.extend(p));
        map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 9 });
      }

      // Wait for map to fully render, then capture as image
      map.once('idle', () => {
        setTimeout(() => {
          const canvas = el.querySelector('canvas');
          if (canvas) {
            try {
              mapImageSrc = canvas.toDataURL('image/png');
              mapLoaded = true;
            } catch (err) {
              console.error('Failed to capture map as image:', err);
              // Keep map visible if capture fails
              mapLoaded = false;
            }
          } else {
            console.error('Canvas element not found');
            mapLoaded = false;
          }
        }, 500);
      });
    });
  });
</script>

<div class="map-wrapper">
  <!-- Hidden map element for rendering -->
  <div bind:this={el} class="map-element" style={(mapLoaded && mapImageSrc) ? 'display: none;' : ''}></div>

  <!-- Static image display -->
  {#if mapLoaded && mapImageSrc}
    <img src={mapImageSrc} alt="Project location map" class="map-image" />
  {/if}

  <div class="map-legend">
    <div class="legend-item">
      <div class="legend-dot legend-dot-blue"></div>
      <span>Project Location</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot legend-dot-red"></div>
      <span>Weather Stations</span>
    </div>
  </div>
</div>

<style>
  .map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .map-element {
    width: 100%;
    height: 100%;
  }

  .map-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .map-legend {
    position: absolute;
    bottom: 12pt;
    left: 12pt;
    background: white;
    border: 1px solid #000000;
    padding: 8pt;
    display: flex;
    flex-direction: column;
    gap: 6pt;
    font-size: 10pt;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6pt;
  }

  .legend-dot {
    width: 10pt;
    height: 10pt;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 0 1px #000000;
  }

  .legend-dot-blue {
    background-color: #2563eb;
  }

  .legend-dot-red {
    background-color: #e53935;
  }
</style>
