# 3D China-to-Beijing Route Visualization

This project is a static Three.js web experience that shows:

- A stylized 3D extruded map (China or Beijing)
- A photo-to-particle morph intro
- A route flight from each person's origin to Beijing
- A second-stage camera fly-in to Haidian destination
- Automatic cycling through configured people/photos

## Tech Stack

- Vanilla HTML/CSS/JS
- [Three.js](https://threejs.org/) via import map CDN
- GeoJSON map data (local files with remote fallback)

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- main.js
|-- china.geojson
|-- Beijing.geojson
`-- data/
    |-- dataset.js
    `-- *.jpg / *.png
```

## Run Locally

Use a local dev server. Opening `index.html` directly with `file://` may break `fetch()` for GeoJSON.

```bash
cd /home/carter/working/people
npm install
npm run dev
```

Then open:

```text
http://localhost:8000
```

`npm run dev` uses `live-server`, which automatically reloads the browser when you change files.
If port `8000` is already occupied, `live-server` will print and use another available port.

If you only need a basic static server without auto reload:

```bash
npm run serve
```

## Configure Content

Edit `data/dataset.js` (runtime config used by `main.js`):

- `PHOTO_SET`: People name, image path, origin city, and origin coordinates
- `ROUTE_VIEW_MODE`: `"two-stage"` or `"single-map"`
- `DESTINATION_NAME`: Label text for destination
- `MAP_SOURCES`: Local/remote GeoJSON sources and map labels

## Interaction and Behavior

- Drag to rotate map
- Mouse wheel to zoom
- Top-left map toggle switches between China/Beijing views
- Intro runs automatically:
  1. Photo appears
  2. Photo particles morph into the origin marker
  3. Route animates to Beijing
  4. Camera flies to Haidian destination and label appears
  5. Next photo/person starts

## Notes

- The app caches loaded GeoJSON in memory (`geoJsonCache`) during the session.
- If local GeoJSON is unavailable, it tries Aliyun boundary endpoints in `MAP_SOURCES`.
- Keep image paths in `PHOTO_SET` valid relative to project root.
