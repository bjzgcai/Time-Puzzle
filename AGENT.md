# AGENT

Project concept: static Three.js story loop:
`Photo Intro -> Photo-to-Origin Morph -> Route Flight -> Destination Fly-in -> Next Person`.

## Canonical Terms (Use These)
- `Person`: one entry in `PHOTO_SET`.
- `Photo Intro`: the person photo shown before animation starts.
- `Photo-to-Origin Morph`: photo particles collapse to the person's origin marker.
- `Origin`: where a person is from (`originCity` + `originCoord`).
- `Origin Marker`: visual marker at the origin point.
- `Route Flight`: animated path from `Origin` to Beijing.
- `Destination`: fixed endpoint (`DESTINATION_NAME`, currently Haidian in Beijing).
- `Destination Marker`: marker/label for the destination.
- `Cycle`: automatic transition to the next person.
- `Route View Mode`: `two-stage` or `single-map`.

## Term Mapping (Old -> Preferred)
- `汇聚点` -> `Destination`
- `Origin points` -> `Origins`
- `Route` -> `Route Flight`
- `photo intro` -> `Photo Intro`

## How To Ask the Coding Agent
- "Update a `Person` in `PHOTO_SET` (name/date/photo/origin)."
- "Change `Destination` text or coordinates."
- "Adjust `Route Flight` speed/curve/timing."
- "Tune `Photo Intro` duration or transition effect."
- "Switch `Route View Mode` to `two-stage`/`single-map`."

## Run
- `npm install`
- `npm run dev` (default: `http://localhost:8000`)

## Where To Edit
- `data/dataset.js`: people data, destination, route mode, map sources.
- `main.js`: scene, animation flow, camera behavior, route logic.
- `index.html`, `styles.css`: UI shell and styles.

## Assets
- Local GeoJSON: `china.geojson`, `Beijing.geojson` (remote fallback in config).
- Images in `data/`; keep `PHOTO_SET[].src` paths valid.
