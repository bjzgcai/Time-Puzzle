import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CHINA_CENTER,
  BEIJING_COORD,
  HAIDIAN_PARK_COORD,
  DESTINATION_NAME,
  ROUTE_VIEW_MODE,
  PHOTO_SET,
  MAP_SOURCES
} from "./data/dataset.js";

const MAP_DEPTH = 1.6;
const CAMERA_HOME = new THREE.Vector3(0, 42, 69);
const CONTROL_HOME = new THREE.Vector3(0, 1.4, 0);

const canvas = document.getElementById("sceneCanvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0603);
scene.fog = new THREE.Fog(0x090603, 56, 138);

const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / window.innerHeight,
  0.1,
  480
);
camera.position.copy(CAMERA_HOME);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.copy(CONTROL_HOME);
controls.minDistance = 34;
controls.maxDistance = 108;
controls.maxPolarAngle = Math.PI / 2.02;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

let userMoved = false;
controls.addEventListener("start", () => {
  userMoved = true;
  controls.autoRotate = false;
});

const mapRoot = new THREE.Group();
scene.add(mapRoot);

addLighting(scene);
addAtmosphere(scene);

const mapMeta = {
  scale: 1,
  lonFactor: 1,
  centerLon: CHINA_CENTER.lon,
  centerLat: CHINA_CENTER.lat,
  shift: new THREE.Vector3()
};
const geoJsonCache = new Map();
const PHOTO_GROUPS = buildPhotoGroups(PHOTO_SET);

let currentMapMode = "china";
let mapSwitchPending = false;
let mapToggleEl = null;
const mapToggleButtons = [];
let stage2TransitionPending = false;
let activeGroupIndex = 0;
let activePhotoIndex = 0;
let cycleToken = 0;
let nextCycleTimerId = 0;

let beijingMarker = null;
let haidianMarker = null;
let originMarkers = [];
let introFinished = false;

const photoStage = document.getElementById("photoStage");
const photoEl = document.getElementById("photo");
const particleCanvas = document.getElementById("photoParticles");
const pctx = particleCanvas.getContext("2d", { alpha: true, desynchronized: true });
const photoThumbDock = document.getElementById("photoThumbDock");
const poiLabel = document.getElementById("poiLabel");
const capturedThumbs = new Set();

const cameraFlight = {
  active: false,
  completed: false,
  startedAt: 0,
  durationMs: 2900,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toTarget: new THREE.Vector3()
};

const routeFlight = {
  active: false,
  completed: false,
  startedAt: 0,
  durationMs: 2500,
  flights: []
};

const labelAnchorWorld = new THREE.Vector3();
const routeTempPoint = new THREE.Vector3();

const morphState = {
  particles: [],
  active: false,
  startedAt: 0,
  holdMs: 1200,
  morphMs: 2550,
  done: false,
  sparkle: 0
};

init().catch((err) => {
  console.error(err);
});

async function init() {
  if (!PHOTO_SET.length || !PHOTO_GROUPS.length) {
    throw new Error("PHOTO_SET 为空，请至少配置一张照片");
  }
  createMapToggle();
  resizeParticleCanvas();
  await startPhotoCycle(0);
  window.addEventListener("resize", onResize);
  animate();
}

function buildPhotoGroups(photos) {
  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < photos.length; i += 1) {
    const photo = photos[i];
    const date = photo?.date ?? "unknown-date";
    if (!currentGroup || currentGroup.date !== date) {
      currentGroup = {
        date,
        photos: [],
        indices: []
      };
      groups.push(currentGroup);
    }

    currentGroup.photos.push(photo);
    currentGroup.indices.push(i);
  }

  return groups;
}

function getActiveGroup() {
  return PHOTO_GROUPS[activeGroupIndex] ?? PHOTO_GROUPS[0];
}

function getActivePhoto() {
  const activeGroup = getActiveGroup();
  return activeGroup?.photos[0] ?? PHOTO_SET[activePhotoIndex] ?? PHOTO_SET[0];
}

function isBeijingOrigin(photo = getActivePhoto()) {
  return Boolean(photo?.originCity?.includes("北京市"));
}

function getGroupStartMapMode(group = getActiveGroup()) {
  const hasExternalOrigin = group?.photos?.some((photo) => !isBeijingOrigin(photo));
  return hasExternalOrigin ? "china" : "beijing";
}

function getPhotosForCurrentMap(mapMode = currentMapMode) {
  const group = getActiveGroup();
  if (!group?.photos?.length) {
    return [];
  }

  if (mapMode === "beijing") {
    return group.photos.filter((photo) => isBeijingOrigin(photo));
  }

  return group.photos.filter((photo) => !isBeijingOrigin(photo));
}

function applyActivePhoto() {
  const activeGroup = getActiveGroup();
  const photo = getActivePhoto();
  if (!photo) {
    return;
  }

  photoEl.src = photo.src;
  photoEl.alt = `${photo.name}（${photo.originCity}，入职 ${photo.date}）`;

  const hudHint = document.querySelector("#hud p");
  if (hudHint) {
    const modeText = ROUTE_VIEW_MODE === "two-stage" ? "双阶段" : "单地图";
    const memberCount = activeGroup?.photos?.length ?? 1;
    const originText = memberCount > 1 ? `${photo.originCity} 等${memberCount}人` : photo.originCity;
    hudHint.textContent = `${photo.date} · ${originText} → 北京市（${modeText}） · 拖拽旋转 · 滚轮缩放`;
  }

  if (poiLabel) {
    poiLabel.setAttribute("aria-label", `${DESTINATION_NAME}`);
  }
}

function clearNextCycleTimer() {
  if (nextCycleTimerId) {
    clearTimeout(nextCycleTimerId);
    nextCycleTimerId = 0;
  }
}

async function startPhotoCycle(index) {
  const total = PHOTO_GROUPS.length;
  if (!total) {
    return;
  }

  const normalized = ((index % total) + total) % total;
  const token = cycleToken + 1;
  cycleToken = token;
  clearNextCycleTimer();

  activeGroupIndex = normalized;
  const activeGroup = getActiveGroup();
  activePhotoIndex = activeGroup?.indices?.[0] ?? 0;
  introFinished = false;
  stage2TransitionPending = false;

  clearRouteFlightVisuals();
  routeFlight.active = false;
  routeFlight.completed = false;
  cameraFlight.active = false;
  cameraFlight.completed = false;

  morphState.active = false;
  morphState.startedAt = 0;
  morphState.done = false;
  morphState.sparkle = 0;
  morphState.particles = [];

  photoStage.style.display = "";
  photoStage.classList.remove("done", "morphing");
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

  if (poiLabel) {
    poiLabel.classList.remove("show");
    poiLabel.style.transform = "translate(-9999px, -9999px)";
  }

  controls.enabled = false;
  controls.autoRotate = false;
  controls.minDistance = 34;
  controls.maxDistance = 108;
  setMapToggleEnabled(false);

  applyActivePhoto();
  const startMapMode = getGroupStartMapMode(activeGroup);
  await switchMap(startMapMode, { force: true, refreshParticles: false });
  if (token !== cycleToken) {
    return;
  }

  camera.position.copy(CAMERA_HOME);
  controls.target.copy(CONTROL_HOME);
  camera.lookAt(controls.target);
  controls.update();

  await prepareParticles();
  if (token !== cycleToken) {
    return;
  }

  runIntroSequence();
}

async function switchMap(mapMode, { force = false, refreshParticles = true } = {}) {
  if (!MAP_SOURCES[mapMode]) {
    return;
  }

  if (mapSwitchPending) {
    return;
  }

  if (!force && currentMapMode === mapMode) {
    return;
  }

  mapSwitchPending = true;
  setMapToggleEnabled(false);

  try {
    const geoJson = await loadGeoJSON(mapMode);
    buildMap(geoJson, mapMode);
    beijingMarker = addBeijingMarker();
    haidianMarker = addHaidianMarker();
    const visiblePhotos = getPhotosForCurrentMap(mapMode).filter((photo) => photo?.originCoord);
    originMarkers = visiblePhotos.map((photo, idx) =>
      addOriginMarker(photo.originCoord, idx, visiblePhotos.length)
    );
    currentMapMode = mapMode;
    updateMapToggleState();

    if (refreshParticles && !morphState.done) {
      await prepareParticles();
    } else {
      updatePoiLabelPosition();
    }
  } finally {
    mapSwitchPending = false;
    setMapToggleEnabled(true);
    updateMapToggleState();
  }
}

function createMapToggle() {
  if (mapToggleEl) {
    return;
  }

  const panel = document.createElement("div");
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Map mode");
  Object.assign(panel.style, {
    position: "fixed",
    top: "14px",
    left: "14px",
    zIndex: "28",
    display: "flex",
    gap: "6px",
    padding: "6px",
    borderRadius: "999px",
    background: "rgba(18, 10, 5, 0.6)",
    border: "1px solid rgba(255, 208, 140, 0.24)",
    backdropFilter: "blur(8px)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.34)"
  });

  for (const mapMode of Object.keys(MAP_SOURCES)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = MAP_SOURCES[mapMode].label;
    button.dataset.mapMode = mapMode;
    Object.assign(button.style, {
      borderRadius: "999px",
      border: "1px solid rgba(255, 208, 140, 0.35)",
      padding: "7px 14px",
      font: "600 12px/1.1 ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      letterSpacing: "0.04em",
      color: "#f0d8af",
      background: "transparent",
      cursor: "pointer",
      transition: "all 180ms ease"
    });

    button.addEventListener("click", async () => {
      if (mapSwitchPending || mapMode === currentMapMode) {
        return;
      }
      try {
        await switchMap(mapMode);
      } catch (err) {
        console.error(err);
      }
    });

    mapToggleButtons.push(button);
    panel.appendChild(button);
  }

  mapToggleEl = panel;
  document.body.appendChild(panel);
  updateMapToggleState();
}

function setMapToggleEnabled(enabled) {
  for (const button of mapToggleButtons) {
    button.disabled = !enabled;
    button.style.cursor = enabled ? "pointer" : "progress";
    button.style.opacity = enabled ? "1" : "0.72";
  }
}

function updateMapToggleState() {
  for (const button of mapToggleButtons) {
    const isActive = button.dataset.mapMode === currentMapMode;
    button.style.background = isActive ? "#f2c885" : "transparent";
    button.style.borderColor = isActive ? "#f5d39b" : "rgba(255, 208, 140, 0.35)";
    button.style.color = isActive ? "#3f250f" : "#f0d8af";
    button.style.boxShadow = isActive ? "0 3px 12px rgba(0, 0, 0, 0.28)" : "none";
    button.setAttribute("aria-pressed", String(isActive));
  }
}

async function loadGeoJSON(mapMode) {
  if (geoJsonCache.has(mapMode)) {
    return geoJsonCache.get(mapMode);
  }

  const mapConfig = MAP_SOURCES[mapMode];
  if (!mapConfig) {
    throw new Error(`未知地图模式: ${mapMode}`);
  }

  for (const src of mapConfig.sources) {
    try {
      const resp = await fetch(src);
      if (!resp.ok) {
        continue;
      }
      const data = await resp.json();
      geoJsonCache.set(mapMode, data);
      return data;
    } catch {
      // ignore and continue fallback source
    }
  }

  throw new Error(`无法加载地图数据（${mapConfig.errorLabel}）`);
}

function buildMap(geoJson, mapMode) {
  clearMapRoot();

  const mapConfig = MAP_SOURCES[mapMode] ?? MAP_SOURCES.china;
  const coords = [];
  for (const feature of geoJson.features) {
    collectCoordinates(feature.geometry, coords);
  }

  if (!coords.length) {
    throw new Error("地图数据为空，无法绘制");
  }

  const lons = coords.map((p) => p[0]);
  const lats = coords.map((p) => p[1]);

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  mapMeta.centerLon = (minLon + maxLon) / 2;
  mapMeta.centerLat = (minLat + maxLat) / 2;
  mapMeta.lonFactor = Math.cos(THREE.MathUtils.degToRad(mapMeta.centerLat));

  const lonSpan = (maxLon - minLon) * mapMeta.lonFactor;
  const latSpan = maxLat - minLat;
  mapMeta.scale = 60 / Math.max(lonSpan, latSpan * 1.05);

  const parchment = makeParchmentTexture();
  parchment.wrapS = THREE.RepeatWrapping;
  parchment.wrapT = THREE.RepeatWrapping;
  parchment.repeat.set(2.3, 2.3);

  const topMaterial = new THREE.MeshStandardMaterial({
    map: parchment,
    color: 0xd7b573,
    roughness: 0.82,
    metalness: 0.27
  });

  const sideMaterial = new THREE.MeshStandardMaterial({
    map: parchment,
    color: 0x6e4d26,
    roughness: 0.9,
    metalness: 0.16
  });

  const borderMaterial = new THREE.LineBasicMaterial({
    color: 0xf4d08c,
    transparent: true,
    opacity: 0.52
  });

  const provinceGroup = new THREE.Group();

  for (const feature of geoJson.features) {
    const geom = feature.geometry;
    const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;

    for (const polygon of polygons) {
      const maxLat = polygon[0].reduce((m, coord) => Math.max(m, coord[1]), -Infinity);
      if (mapConfig.minVisibleLat != null && maxLat < mapConfig.minVisibleLat) {
        continue;
      }

      const shape = polygonToShape(polygon);
      if (!shape) {
        continue;
      }

      const extrude = new THREE.ExtrudeGeometry(shape, {
        depth: MAP_DEPTH,
        bevelEnabled: false,
        curveSegments: 2
      });
      extrude.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(extrude, [sideMaterial, topMaterial]);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      provinceGroup.add(mesh);

      const linePts = polygon[0].map((coord) => {
        const p = projectLonLat(coord[0], coord[1]);
        return new THREE.Vector3(p.x, MAP_DEPTH + 0.05, -p.y);
      });

      if (linePts.length > 2) {
        const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
        const line = new THREE.LineLoop(lineGeom, borderMaterial);
        provinceGroup.add(line);
      }
    }
  }

  const box = new THREE.Box3().setFromObject(provinceGroup);
  const center = box.getCenter(new THREE.Vector3());
  provinceGroup.position.sub(center);

  mapMeta.shift.copy(center);

  mapRoot.add(provinceGroup);

  const baseDisc = new THREE.Mesh(
    new THREE.CircleGeometry(47, 72),
    new THREE.MeshStandardMaterial({
      color: 0x2c1d0f,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.72
    })
  );
  baseDisc.rotation.x = -Math.PI / 2;
  baseDisc.position.y = -0.36;
  mapRoot.add(baseDisc);
}

function clearMapRoot() {
  while (mapRoot.children.length > 0) {
    const child = mapRoot.children[0];
    mapRoot.remove(child);
    disposeObject3D(child);
  }

  beijingMarker = null;
  haidianMarker = null;
  originMarkers = [];
  routeFlight.flights = [];
  routeFlight.active = false;
  routeFlight.completed = false;
}

function disposeObject3D(object3d) {
  object3d.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }

    const { material } = node;
    if (Array.isArray(material)) {
      for (const mat of material) {
        disposeMaterial(mat);
      }
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material) {
  if (!material) {
    return;
  }

  if (material.map) {
    material.map.dispose();
  }

  material.dispose();
}

function polygonToShape(polygon) {
  if (!polygon || !polygon.length) {
    return null;
  }

  const outer = polygon[0].map((coord) => {
    const p = projectLonLat(coord[0], coord[1]);
    return new THREE.Vector2(p.x, p.y);
  });

  if (outer.length < 3) {
    return null;
  }

  const cleanOuter = dedupeLastPoint(outer);
  if (!THREE.ShapeUtils.isClockWise(cleanOuter)) {
    cleanOuter.reverse();
  }

  const shape = new THREE.Shape(cleanOuter);

  for (let i = 1; i < polygon.length; i += 1) {
    const holePts = polygon[i].map((coord) => {
      const p = projectLonLat(coord[0], coord[1]);
      return new THREE.Vector2(p.x, p.y);
    });

    if (holePts.length < 3) {
      continue;
    }

    const cleanHole = dedupeLastPoint(holePts);
    if (THREE.ShapeUtils.isClockWise(cleanHole)) {
      cleanHole.reverse();
    }

    shape.holes.push(new THREE.Path(cleanHole));
  }

  return shape;
}

function dedupeLastPoint(points) {
  if (points.length < 2) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const same = Math.hypot(first.x - last.x, first.y - last.y) < 1e-6;

  return same ? points.slice(0, points.length - 1) : points;
}

function projectLonLat(lon, lat) {
  return {
    x: (lon - mapMeta.centerLon) * mapMeta.lonFactor * mapMeta.scale,
    y: (lat - mapMeta.centerLat) * mapMeta.scale
  };
}

function collectCoordinates(geometry, into) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const coord of ring) {
        into.push(coord);
      }
    }
    return;
  }

  if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        for (const coord of ring) {
          into.push(coord);
        }
      }
    }
  }
}

function makeParchmentTexture() {
  const size = 1024;
  const canvas2d = document.createElement("canvas");
  canvas2d.width = size;
  canvas2d.height = size;
  const ctx = canvas2d.getContext("2d");

  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.45,
    size * 0.12,
    size * 0.5,
    size * 0.5,
    size * 0.8
  );
  gradient.addColorStop(0, "#b49353");
  gradient.addColorStop(0.45, "#7f5f31");
  gradient.addColorStop(1, "#3f2813");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 130000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const light = 38 + Math.random() * 30;
    const alpha = 0.022 + Math.random() * 0.04;
    ctx.fillStyle = `hsla(38, 56%, ${light}%, ${alpha})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#f0d191";
  ctx.lineWidth = 0.55;

  for (let i = 0; i < 1400; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 10 + Math.random() * 52;
    const angle = Math.random() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len * 0.18);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvas2d);
}

function addLighting(targetScene) {
  const ambient = new THREE.AmbientLight(0xd7b46e, 0.62);
  targetScene.add(ambient);

  const warmKey = new THREE.DirectionalLight(0xffdf9f, 1.3);
  warmKey.position.set(28, 44, 24);
  targetScene.add(warmKey);

  const coolFill = new THREE.DirectionalLight(0x8a6840, 0.58);
  coolFill.position.set(-26, 18, -22);
  targetScene.add(coolFill);

  const rim = new THREE.PointLight(0xffcd75, 1.4, 120, 2);
  rim.position.set(0, 24, 0);
  targetScene.add(rim);
}

function addAtmosphere(targetScene) {
  const starCount = 1700;
  const points = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i += 1) {
    const radius = 65 + Math.random() * 85;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;

    points[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    points[i * 3 + 1] = Math.cos(phi) * radius * 0.55 + 14;
    points[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(points, 3));

  const dustMat = new THREE.PointsMaterial({
    color: 0x9d7a45,
    size: 0.22,
    transparent: true,
    opacity: 0.24,
    depthWrite: false
  });

  const dust = new THREE.Points(dustGeo, dustMat);
  targetScene.add(dust);
}

function addBeijingMarker() {
  const local = beijingLocalPosition();

  const marker = new THREE.Group();
  marker.position.copy(local);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd68d })
  );
  marker.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.05, 10, 42),
    new THREE.MeshBasicMaterial({
      color: 0xffca74,
      transparent: true,
      opacity: 0.8
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.userData.baseScale = 1;
  marker.add(ring);
  marker.userData.ring = ring;

  mapRoot.add(marker);

  return marker;
}

function addHaidianMarker() {
  const marker = new THREE.Group();
  marker.position.copy(lonLatToLocalPosition(HAIDIAN_PARK_COORD, 0.32));

  const pin = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 1.28, 20),
    new THREE.MeshStandardMaterial({
      color: 0xffdda2,
      emissive: 0x5b300d,
      emissiveIntensity: 0.85,
      roughness: 0.42,
      metalness: 0.25
    })
  );
  pin.position.y = 0.68;
  marker.add(pin);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.36, 0.052, 8, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffcf82,
      transparent: true,
      opacity: 0.5
    })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.04;
  marker.add(halo);
  marker.userData.ring = halo;

  const light = new THREE.PointLight(0xffce84, 1.1, 26, 2);
  light.position.set(0, 1.08, 0);
  marker.add(light);

  mapRoot.add(marker);

  return marker;
}

function addOriginMarker(coord, order = 0, total = 1) {
  const marker = new THREE.Group();
  marker.position.copy(lonLatToLocalPosition(coord, 0.26));

  if (total > 1) {
    const angle = (order / total) * Math.PI * 2;
    const radius = Math.min(0.42, 0.12 * total);
    marker.position.x += Math.cos(angle) * radius;
    marker.position.z += Math.sin(angle) * radius;
  }

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xaed8ff })
  );
  marker.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.045, 8, 36),
    new THREE.MeshBasicMaterial({
      color: 0x8fc3ff,
      transparent: true,
      opacity: 0.8
    })
  );
  ring.rotation.x = Math.PI / 2;
  marker.add(ring);
  marker.userData.ring = ring;

  mapRoot.add(marker);
  return marker;
}

function beijingLocalPosition() {
  return lonLatToLocalPosition(BEIJING_COORD, 0.28);
}

function lonLatToLocalPosition(coord, yOffset = 0.28) {
  const p = projectLonLat(coord.lon, coord.lat);
  return new THREE.Vector3(
    p.x - mapMeta.shift.x,
    MAP_DEPTH + yOffset - mapMeta.shift.y,
    -p.y - mapMeta.shift.z
  );
}

async function prepareParticles() {
  await ensureImageLoaded(photoEl);

  const width = window.innerWidth;
  const height = window.innerHeight;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sctx = sourceCanvas.getContext("2d", { willReadFrequently: true });

  drawImageCoverInRect(sctx, photoEl, getPhotoRect());
  const data = sctx.getImageData(0, 0, width, height).data;

  const area = width * height;
  const step = Math.max(5, Math.min(11, Math.round(Math.sqrt(area / 10500))));

  const target = getMorphTargetScreenPosition();
  const particles = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a < 70) {
        continue;
      }

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const startX = x + (Math.random() - 0.5) * 1.8;
      const startY = y + (Math.random() - 0.5) * 1.8;

      const dx = target.x - startX;
      const dy = target.y - startY;
      const angle = Math.atan2(dy, dx);
      const swirl = 20 + Math.random() * 110;
      const curveLift = (Math.random() - 0.5) * 150;

      const c1 = {
        x: startX + dx * 0.35 + Math.cos(angle + Math.PI / 2) * swirl,
        y: startY + dy * 0.2 + Math.sin(angle + Math.PI / 2) * swirl + curveLift
      };

      const c2 = {
        x: startX + dx * 0.7 + Math.cos(angle - Math.PI / 2) * (swirl * 0.45),
        y: startY + dy * 0.85 + Math.sin(angle - Math.PI / 2) * (swirl * 0.45) - curveLift * 0.45
      };

      particles.push({
        startX,
        startY,
        c1,
        c2,
        r,
        g,
        b,
        size: 1 + Math.random() * 1.5,
        offset: Math.random() * 0.08
      });
    }
  }

  morphState.particles = particles;
}

function runIntroSequence() {
  morphState.startedAt = performance.now();

  controls.enabled = false;
  controls.autoRotate = false;
  setMapToggleEnabled(false);
}

function pinCurrentPhotoThumbnail(photoIndex = activePhotoIndex) {
  if (!photoThumbDock) {
    return;
  }

  const photo = PHOTO_SET[photoIndex];
  if (!photo) {
    return;
  }

  const thumbKey = `${photoIndex}:${photo.src}`;
  if (capturedThumbs.has(thumbKey)) {
    return;
  }

  const thumb = document.createElement("div");
  thumb.className = "photoThumb fresh";
  thumb.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.src = photo.src;
  img.alt = `${photo.name} 缩略图`;
  thumb.appendChild(img);

  photoThumbDock.appendChild(thumb);
  capturedThumbs.add(thumbKey);

  setTimeout(() => {
    thumb.classList.remove("fresh");
  }, 520);
}

function pinActiveGroupThumbnails() {
  const activeGroup = getActiveGroup();
  if (!activeGroup?.indices?.length) {
    return;
  }

  for (const index of activeGroup.indices) {
    pinCurrentPhotoThumbnail(index);
  }
}

function clearThumbnailDock() {
  capturedThumbs.clear();
  if (photoThumbDock) {
    photoThumbDock.replaceChildren();
  }
}

function drawMorphFrame(now) {
  if (morphState.done) {
    return;
  }

  const elapsed = now - morphState.startedAt;

  if (elapsed < morphState.holdMs) {
    return;
  }

  if (!morphState.active) {
    morphState.active = true;
    photoStage.classList.add("morphing");
  }

  const tRaw = (elapsed - morphState.holdMs) / morphState.morphMs;
  const t = THREE.MathUtils.clamp(tRaw, 0, 1);
  const eased = easeInOutCubic(t);

  const target = getMorphTargetScreenPosition();
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

  pctx.globalCompositeOperation = "lighter";

  for (const p of morphState.particles) {
    const tt = THREE.MathUtils.clamp(eased + p.offset * (1 - eased), 0, 1);

    const x = cubicBezier(p.startX, p.c1.x, p.c2.x, target.x, tt);
    const y = cubicBezier(p.startY, p.c1.y, p.c2.y, target.y, tt);

    const size = Math.max(0.45, p.size * (1 - tt * 0.86));
    const alpha = Math.max(0.05, 0.95 - tt * 0.9);

    pctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
    pctx.fillRect(x, y, size, size);
  }

  const glowRadius = 6 + (1 - eased) * 22;
  const glow = pctx.createRadialGradient(
    target.x,
    target.y,
    0,
    target.x,
    target.y,
    glowRadius
  );
  glow.addColorStop(0, "rgba(255,228,170,0.95)");
  glow.addColorStop(0.35, "rgba(255,200,110,0.6)");
  glow.addColorStop(1, "rgba(255,165,84,0)");

  pctx.fillStyle = glow;
  pctx.beginPath();
  pctx.arc(target.x, target.y, glowRadius, 0, Math.PI * 2);
  pctx.fill();

  if (t >= 1) {
    morphState.done = true;
    photoStage.classList.remove("morphing");
    photoStage.classList.add("done");

    setTimeout(() => {
      pinActiveGroupThumbnails();
      photoStage.style.display = "none";
      introFinished = true;
      morphState.sparkle = performance.now();
      if (!startRouteAfterMorph(morphState.sparkle)) {
        handleArrivalAtBeijing(morphState.sparkle);
      }
    }, 420);
  }
}

function startRouteAfterMorph(startTime = performance.now()) {
  if (currentMapMode === "beijing") {
    return startBeijingFlightToHaidian(startTime);
  }
  return startChinaFlightToBeijing(startTime);
}

function buildRouteFlightEntry(start, end, order = 0, total = 1) {
  const p0 = start.clone();
  const p3 = end.clone();

  if (total > 1) {
    const angle = (order / total) * Math.PI * 2;
    const spread = 0.62;
    p3.x += Math.cos(angle) * spread;
    p3.z += Math.sin(angle) * spread;
  }

  const distance = p0.distanceTo(p3);
  const lift = THREE.MathUtils.clamp(distance * 0.22, 3.2, 9.4);

  const lateral = new THREE.Vector3().subVectors(p3, p0);
  lateral.y = 0;
  if (lateral.lengthSq() < 1e-6) {
    lateral.set(1, 0, 0);
  }
  lateral.normalize();

  const normal = new THREE.Vector3(-lateral.z, 0, lateral.x).multiplyScalar(distance * 0.08);
  const p1 = p0
    .clone()
    .lerp(p3, 0.34)
    .add(normal)
    .add(new THREE.Vector3(0, lift, 0));
  const p2 = p0
    .clone()
    .lerp(p3, 0.7)
    .addScaledVector(normal, -0.58)
    .add(new THREE.Vector3(0, lift * 0.72, 0));

  const routeColors = [0xffd79a, 0xffc36e, 0xffe6b8, 0xfcc07e, 0xf9d4a0];
  const color = routeColors[order % routeColors.length];

  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([p0.clone(), p0.clone()]),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85
    })
  );
  mapRoot.add(trail);

  const mover = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 16, 16),
    new THREE.MeshBasicMaterial({ color })
  );
  mover.position.copy(p0);
  mapRoot.add(mover);

  return { p0, p1, p2, p3, mover, trail };
}

function startChinaFlightToBeijing(startTime = performance.now()) {
  if (currentMapMode !== "china" || !originMarkers.length || !beijingMarker) {
    return false;
  }

  clearRouteFlightVisuals();

  routeFlight.flights = originMarkers.map((originMarker, idx) =>
    buildRouteFlightEntry(originMarker.position, beijingMarker.position, idx, originMarkers.length)
  );
  if (!routeFlight.flights.length) {
    return false;
  }

  routeFlight.startedAt = startTime;
  routeFlight.active = true;
  routeFlight.completed = false;
  return true;
}

function startBeijingFlightToHaidian(startTime = performance.now()) {
  if (currentMapMode !== "beijing" || !originMarkers.length || !haidianMarker) {
    return false;
  }

  clearRouteFlightVisuals();

  routeFlight.flights = originMarkers.map((originMarker, idx) =>
    buildRouteFlightEntry(originMarker.position, haidianMarker.position, idx, originMarkers.length)
  );
  if (!routeFlight.flights.length) {
    return false;
  }

  routeFlight.startedAt = startTime;
  routeFlight.active = true;
  routeFlight.completed = false;
  return true;
}

function updateRouteFlight(now) {
  if (!routeFlight.active) {
    return;
  }

  if (!routeFlight.flights.length) {
    routeFlight.active = false;
    return;
  }

  const tRaw = (now - routeFlight.startedAt) / routeFlight.durationMs;
  const t = THREE.MathUtils.clamp(tRaw, 0, 1);
  const eased = easeInOutCubic(t);

  for (const flight of routeFlight.flights) {
    if (!flight?.mover || !flight?.trail) {
      continue;
    }

    cubicBezierVec3(flight.p0, flight.p1, flight.p2, flight.p3, eased, routeTempPoint);
    flight.mover.position.copy(routeTempPoint);

    const points = [];
    const segs = Math.max(16, Math.round(66 * eased));
    for (let i = 0; i <= segs; i += 1) {
      const tt = eased * (i / segs);
      const p = new THREE.Vector3();
      cubicBezierVec3(flight.p0, flight.p1, flight.p2, flight.p3, tt, p);
      points.push(p);
    }
    flight.trail.geometry.setFromPoints(points);
    flight.trail.geometry.computeBoundingSphere();
  }

  if (t >= 1) {
    routeFlight.active = false;
    routeFlight.completed = true;
    clearRouteFlightVisuals();
    handleArrivalAtBeijing(now);
  }
}

function handleArrivalAtBeijing(startTime = performance.now()) {
  if (stage2TransitionPending) {
    return;
  }

  if (ROUTE_VIEW_MODE === "two-stage" && currentMapMode !== "beijing") {
    stage2TransitionPending = true;
    switchMap("beijing", { force: true, refreshParticles: false })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        stage2TransitionPending = false;
        startHaidianFlyIn(performance.now());
      });
    return;
  }

  startHaidianFlyIn(startTime);
}

function clearRouteFlightVisuals() {
  for (const flight of routeFlight.flights) {
    if (flight?.mover?.parent) {
      flight.mover.parent.remove(flight.mover);
      disposeObject3D(flight.mover);
    }
    if (flight?.trail?.parent) {
      flight.trail.parent.remove(flight.trail);
      disposeObject3D(flight.trail);
    }
  }
  routeFlight.flights = [];
}

function queueNextPhotoCycle() {
  if (PHOTO_GROUPS.length <= 1) {
    return;
  }

  const nextIndex = (activeGroupIndex + 1) % PHOTO_GROUPS.length;
  clearNextCycleTimer();
  nextCycleTimerId = window.setTimeout(() => {
    if (nextIndex === 0) {
      clearThumbnailDock();
    }
    startPhotoCycle(nextIndex).catch((err) => {
      console.error(err);
    });
  }, 1400);
}

function startHaidianFlyIn(startTime = performance.now()) {
  if (!haidianMarker) {
    controls.enabled = true;
    controls.autoRotate = !userMoved;
    setMapToggleEnabled(true);
    return;
  }

  const focusWorld = new THREE.Vector3();
  haidianMarker.getWorldPosition(focusWorld);

  cameraFlight.fromPos.copy(camera.position);
  cameraFlight.fromTarget.copy(controls.target);
  cameraFlight.toTarget.copy(focusWorld).add(new THREE.Vector3(0, 0.12, 0));

  const approach = new THREE.Vector3(1.05, 0.86, 1.08).normalize().multiplyScalar(11.6);
  cameraFlight.toPos.copy(cameraFlight.toTarget).add(approach);

  cameraFlight.startedAt = startTime;
  cameraFlight.active = true;
  cameraFlight.completed = false;

  if (poiLabel) {
    poiLabel.classList.remove("show");
  }

  controls.autoRotate = false;
  controls.enabled = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 48;
}

function updateCameraFlight(now) {
  if (!cameraFlight.active) {
    return;
  }

  const tRaw = (now - cameraFlight.startedAt) / cameraFlight.durationMs;
  const t = THREE.MathUtils.clamp(tRaw, 0, 1);
  const eased = easeInOutCubic(t);

  camera.position.lerpVectors(cameraFlight.fromPos, cameraFlight.toPos, eased);
  controls.target.lerpVectors(cameraFlight.fromTarget, cameraFlight.toTarget, eased);
  camera.lookAt(controls.target);

  if (t >= 1) {
    cameraFlight.active = false;
    cameraFlight.completed = true;
    controls.enabled = true;
    controls.autoRotate = false;
    setMapToggleEnabled(true);
    controls.target.copy(cameraFlight.toTarget);
    controls.update();
    showPoiLabel();
    queueNextPhotoCycle();
  }
}

function showPoiLabel() {
  if (!poiLabel) {
    return;
  }
  poiLabel.classList.add("show");
  updatePoiLabelPosition();
}

function updatePoiLabelPosition() {
  if (!poiLabel || !haidianMarker || !poiLabel.classList.contains("show")) {
    return;
  }

  haidianMarker.getWorldPosition(labelAnchorWorld);
  labelAnchorWorld.y += 2.05;

  const projected = labelAnchorWorld.clone().project(camera);
  const isVisible =
    projected.z > -1 &&
    projected.z < 1 &&
    projected.x > -1.25 &&
    projected.x < 1.25 &&
    projected.y > -1.25 &&
    projected.y < 1.25;

  if (!isVisible) {
    poiLabel.style.opacity = "0";
    return;
  }

  poiLabel.style.opacity = "";
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  poiLabel.style.transform = `translate(${x}px, ${y}px) translate(24px, -58px)`;
}

function drawImageCoverInRect(ctx, image, rect) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const scale = Math.max(rect.width / iw, rect.height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.width - dw) / 2;
  const dy = rect.y + (rect.height - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}

function getPhotoRect() {
  const rect = photoEl.getBoundingClientRect();
  const hasValidRect = rect.width > 0 && rect.height > 0;

  if (hasValidRect) {
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  const width = Math.max(180, Math.min(window.innerWidth * 0.24, 360));
  const height = width / 0.75;
  return {
    x: (window.innerWidth - width) / 2,
    y: (window.innerHeight - height) / 2,
    width,
    height
  };
}

function ensureImageLoaded(img) {
  if (img.complete && img.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });
}

function getMorphTargetScreenPosition() {
  const anchorOriginMarker = originMarkers[0];
  if (anchorOriginMarker) {
    const world = new THREE.Vector3();
    anchorOriginMarker.getWorldPosition(world);
    const projected = world.project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  return getBeijingScreenPosition();
}

function getBeijingScreenPosition() {
  if (!beijingMarker) {
    return { x: window.innerWidth * 0.54, y: window.innerHeight * 0.45 };
  }

  const world = new THREE.Vector3();
  beijingMarker.getWorldPosition(world);

  const projected = world.project(camera);

  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight
  };
}

function resizeParticleCanvas() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  resizeParticleCanvas();

  if (!morphState.done) {
    prepareParticles().catch(() => {});
  }

  updatePoiLabelPosition();
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  if (cameraFlight.active) {
    updateCameraFlight(now);
  } else {
    controls.update();
  }

  updateRouteFlight(now);
  animateMarkers(now);
  updatePoiLabelPosition();

  if (!introFinished) {
    drawMorphFrame(now);
  }

  renderer.render(scene, camera);
}

function animateMarkers(now) {
  if (beijingMarker) {
    const ring = beijingMarker.userData.ring;
    const pulse = 1 + Math.sin(now * 0.0045) * 0.22;
    ring.scale.setScalar(pulse);
    ring.material.opacity = 0.55 + Math.sin(now * 0.0052) * 0.25;

    if (morphState.sparkle > 0) {
      const elapsed = now - morphState.sparkle;
      if (elapsed < 1200) {
        const kick = 1 + (1 - elapsed / 1200) * 0.6;
        ring.scale.setScalar(pulse * kick);
      }
    }
  }

  if (haidianMarker) {
    const ring = haidianMarker.userData.ring;
    const base = 1 + Math.sin(now * 0.006) * 0.18;
    const focusBoost = cameraFlight.completed ? 0.24 : 0;
    ring.scale.setScalar(base + focusBoost);
    ring.material.opacity = cameraFlight.completed ? 0.88 : 0.48;
  }

  for (const originMarker of originMarkers) {
    const ring = originMarker?.userData?.ring;
    if (!ring) {
      continue;
    }
    const pulse = 1 + Math.sin(now * 0.0058) * 0.14;
    ring.scale.setScalar(pulse);
    ring.material.opacity = 0.5 + Math.sin(now * 0.0052) * 0.2;
  }
}

function cubicBezier(p0, p1, p2, p3, t) {
  const nt = 1 - t;
  return (
    nt * nt * nt * p0 +
    3 * nt * nt * t * p1 +
    3 * nt * t * t * p2 +
    t * t * t * p3
  );
}

function cubicBezierVec3(p0, p1, p2, p3, t, out) {
  out.set(
    cubicBezier(p0.x, p1.x, p2.x, p3.x, t),
    cubicBezier(p0.y, p1.y, p2.y, p3.y, t),
    cubicBezier(p0.z, p1.z, p2.z, p3.z, t)
  );
  return out;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
