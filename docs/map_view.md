# Map View and Basemap Configuration

This page explains how the map in `src/lib/components/project-info/MapView.svelte` is rendered, how tiles are retrieved (currently from MapTiler), and how to point the component at a different map source.

## How the map is rendered

- Library: The component lazy-loads **MapLibre GL JS** on mount.
- Style JSON: A MapLibre style URL drives all requests for tiles, sprites, and fonts. Default is built from the public env var `PUBLIC_MAPTILER_KEY`:
  - `.env`: `PUBLIC_MAPTILER_KEY=your_maptiler_api_key`
  - Effective URL: `https://api.maptiler.com/maps/streets/style.json?key=${PUBLIC_MAPTILER_KEY}`
- View initialization: The map is created with `center` and `zoom: 9`.
- Data layers:
  - `center-point` source and `center-circle` layer highlight the selected station.
  - `points` source and `points-circles` layer show other stations.
- Fit bounds: After load, it expands the view to include the center point and any extra points with padding.
- Reactive updates: If `center` or `points` change, the GeoJSON sources are updated without recreating the map.

## Current MapTiler usage

- Provider: MapTiler-hosted vector tiles and sprites, referenced through the style URL above.
- Access: The API key comes from `PUBLIC_MAPTILER_KEY` at build/runtime (not hardcoded). Override the entire URL via the `styleUrl` prop if you prefer.
- What travels over the network: Style JSON, vector tiles, and sprite assets pulled from MapTiler domains defined inside the style JSON.

## Switching to a different map source

You can point the component at any MapLibre-compatible style. At a minimum you need a public HTTPS URL to a style JSON that references reachable tile and sprite URLs.

### Option A — Replace the default URL
1) Edit `styleUrl` default in `src/lib/components/project-info/MapView.svelte`:
   ```js
   export let styleUrl = 'https://your-provider/style.json?key=YOUR_KEY';
   ```
2) Ensure the style uses tile/sprite URLs your users can reach (and that any tokens are valid).

### Option B — Pass the URL from the parent (preferred for keys)
1) Obtain a style URL from your provider (examples below).
2) Store secrets outside the codebase (e.g., an environment variable or server route that returns the style URL).
3) Pass it as a prop: `<MapView {center} {points} styleUrl={myStyleUrl} />`.

### Provider examples

- **MapTiler:** `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`
- **Mapbox:** `https://api.mapbox.com/styles/v1/YOUR_USER/YOUR_STYLE_ID?access_token=YOUR_TOKEN`
- **Stadia / OpenMapTiles-hosted:** Use their style URL; confirm it is MapLibre-compatible.
- **Self-hosted tileserver (tileserver-gl / PMTiles):** Point to your own style JSON; ensure CORS is enabled.

### Common pitfalls

- Tokens required: Most hosted providers need an API key or token attached to the style URL and tile endpoints.
- HTTPS only: Browsers will block mixed content if the style references `http://` tiles when your app is served over HTTPS.
- CORS: If self-hosting, configure CORS to allow your app’s origin to fetch tiles and sprites.
- Sprites/fonts: If you customize the style, keep sprite and glyph URLs valid; missing sprites will break icons.

## Quick verification checklist after changing sources

- Map loads with no console errors (tiles, sprites, fonts).
- Basemap appears at several zoom levels.
- Center and point markers render with expected colors and strokes.
- Fit-to-bounds still works and keeps markers in view.
