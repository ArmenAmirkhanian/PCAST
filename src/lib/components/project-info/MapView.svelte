<script>
  import { onMount } from 'svelte';
  import { PUBLIC_MAPTILER_KEY } from '$env/static/public';

  const defaultStyleUrl = PUBLIC_MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets/style.json?key=${PUBLIC_MAPTILER_KEY}`
    : 'https://api.maptiler.com/maps/streets/style.json';

  export let center = [-87.5692, 33.2098];
  export let points = []; // array of [lng, lat], e.g. [[-86.75,33.56], ...]
  export let styleUrl = defaultStyleUrl; // override from parent to use a different provider or style
  let el;
  let map;

  // Non-center points (e.g., stations)
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

  // Center point highlighted separately
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
    const maplibregl = (await import('maplibre-gl')).default;
    map = new maplibregl.Map({ container: el, style: styleUrl, center, zoom: 9 });

    map.on('load', () => {
      map.addSource('center-point', { type: 'geojson', data: toCenterFC() });
      map.addSource('points', { type: 'geojson', data: toPointsFC() });

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
      });

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
      });
      // Fit bounds
      const all = [center, ...points].filter(Boolean);
      if (all.length) {
        const b = new maplibregl.LngLatBounds(all[0], all[0]);
        all.forEach(p => b.extend(p));
        map.fitBounds(b, { padding: 40, duration: 0 });
      }
    });

  });

  // If data changes later, update sources
  $: if (el && map?.getSource?.('points')) {
    map.getSource('points').setData(toPointsFC());
  }
  $: if (el && map?.getSource?.('center-point')) {
    map.getSource('center-point').setData(toCenterFC());
  }
</script>

<div bind:this={el} style="height:420px;width:100%;border-radius:10px;overflow:hidden;"></div>
