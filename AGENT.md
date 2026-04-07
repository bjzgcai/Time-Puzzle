# AGENT

Static Three.js visualization: photo intro -> origin marker -> route to Beijing -> auto cycle.

汇聚点: is the destination (Beijing).
Origin points: where people are from. 
Route: path from origin to destination.
photo intro: a photo of the person.

## Run
- `npm install`
- `npm run dev` (default: `http://localhost:8000`)

## Edit Points
- `data/dataset.js`: people, origins, map sources, route mode.
- `main.js`: scene, map rendering, animation flow, camera/route logic.
- `index.html`, `styles.css`: UI shell and styles.

## Assets
- Local GeoJSON: `china.geojson`, `Beijing.geojson` (remote fallback in config).
- Images in `data/`; keep `PHOTO_SET[].src` paths valid.
