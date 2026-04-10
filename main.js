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
const HAIDIAN_MARKER_ICON_SRC = "./data/aggregation-marker.png";
const markerTextureLoader = new THREE.TextureLoader();

const leftPaneEl = document.getElementById("leftPane");
const canvas = document.getElementById("sceneCanvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const initialSceneSize = getSceneSize();
renderer.setSize(initialSceneSize.width, initialSceneSize.height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0603);
scene.fog = new THREE.Fog(0x090603, 56, 138);

const camera = new THREE.PerspectiveCamera(
  46,
  initialSceneSize.width / initialSceneSize.height,
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
const groupStagePhotoSrcCache = new Map();
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
let morphCompleteTimerId = 0;

let beijingMarker = null;
let haidianMarker = null;
let originMarkers = [];
let introFinished = false;

const photoStage = document.getElementById("photoStage");
const photoEl = document.getElementById("photo");
const photoCardsEl = document.getElementById("photoCards");
const photoNameEl = document.getElementById("photoName");
const cornerNameEl = document.getElementById("cornerName");
const photoThumbDock = document.getElementById("photoThumbDock");
const poiLabel = document.getElementById("poiLabel");
const zgcGraphWrapEl = document.getElementById("zgcGraphWrap");
const zgcLinksEl = document.getElementById("zgcLinks");
const zgcJoinLayerEl = document.getElementById("zgcJoinLayer");
const zgcCoreEl = document.getElementById("zgcCore");
const zgcActivityListEl = document.getElementById("zgcActivityList");
const capturedThumbs = new Set();
let morphTargetThumbEl = null;

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
const routeTempAhead = new THREE.Vector3();
const routeTempHeading = new THREE.Vector3();

const morphState = {
  active: false,
  startedAt: 0,
  holdMs: 1200,
  morphMs: 2550,
  done: false,
  sparkle: 0
};

const ZGC_CORE_POINT = { x: 50, y: 52 };
const ZGC_DOMAIN_MAX_STRENGTH_SCALE = 1.16;
const ZGC_DOMAIN_DEFS = [
  { key: "ai_science", label: "AI+Science", x: 67, y: 28 },
  { key: "ai_industry", label: "AI+Industry", x: 80, y: 46 },
  { key: "ai_society", label: "AI+Society", x: 74, y: 69 },
  { key: "ai_core", label: "AI Core", x: 50, y: 79 },
  { key: "ai_education", label: "AI教育", x: 26, y: 69 },
  { key: "edu_talent", label: "教科人培养", x: 20, y: 46 },
  { key: "smart_campus", label: "智慧校园\n(含 AI+智慧校园)", x: 33, y: 28 }
];

const ZGC_DOMAIN_ALIAS_MAP = {
  "AI+Science": "ai_science",
  "AI+科研": "ai_science",
  "AI+Industry": "ai_industry",
  "AI+Society": "ai_society",
  "AI Core": "ai_core",
  AICore: "ai_core",
  "AI教育": "ai_education",
  "教科人培养": "edu_talent",
  "智慧校园": "smart_campus",
  "AI+智慧校园": "smart_campus",
  "智慧校园（含 AI+智慧校园）": "smart_campus",
  "智慧校园(含 AI+智慧校园)": "smart_campus"
};

const zgcDomainEls = new Map();
const zgcDomainLinkEls = new Map();
const zgcActivityEls = new Map();
const zgcDomainLevels = new Map();
let zgcJoinTimers = [];
let zgcJoinSequenceToken = 0;

init().catch((err) => {
  console.error(err);
});

async function init() {
  if (!PHOTO_SET.length || !PHOTO_GROUPS.length) {
    throw new Error("PHOTO_SET 为空，请至少配置一张照片");
  }
  setupZgcDomainNetwork();
  onResize();
  createMapToggle();
  await startPhotoCycle(0);
  window.addEventListener("resize", onResize);
  animate();
}

function getSceneSize() {
  return {
    width: Math.max(1, Math.round(leftPaneEl?.clientWidth || window.innerWidth)),
    height: Math.max(1, Math.round(leftPaneEl?.clientHeight || window.innerHeight))
  };
}

function setupZgcDomainNetwork() {
  if (!zgcGraphWrapEl || !zgcLinksEl) {
    return;
  }

  clearZgcJoinTimers();
  zgcDomainEls.clear();
  zgcDomainLinkEls.clear();
  zgcDomainLevels.clear();
  zgcActivityEls.clear();

  zgcGraphWrapEl.querySelectorAll(".zgcDomain").forEach((el) => {
    el.remove();
  });
  zgcLinksEl.replaceChildren();

  const svgNs = "http://www.w3.org/2000/svg";
  for (const domain of ZGC_DOMAIN_DEFS) {
    const link = document.createElementNS(svgNs, "line");
    link.classList.add("zgcLink");
    link.setAttribute("x1", String(ZGC_CORE_POINT.x));
    link.setAttribute("y1", String(ZGC_CORE_POINT.y));
    link.setAttribute("x2", String(domain.x));
    link.setAttribute("y2", String(domain.y));
    zgcLinksEl.appendChild(link);
    zgcDomainLinkEls.set(domain.key, link);

    const node = document.createElement("div");
    node.className = "zgcDomain";
    node.style.setProperty("--x", String(domain.x));
    node.style.setProperty("--y", String(domain.y));
    node.style.setProperty("--strength", "0");

    const label = document.createElement("span");
    label.textContent = domain.label;
    node.appendChild(label);

    zgcGraphWrapEl.appendChild(node);
    zgcDomainEls.set(domain.key, node);
    zgcDomainLevels.set(domain.key, 0);
    updateZgcDomainVisual(domain.key);
  }

  layoutZgcDomainNodes();
  requestAnimationFrame(() => {
    layoutZgcDomainNodes();
  });

  renderZgcEmptyActivity("等待成员加入...");
}

function layoutZgcDomainNodes() {
  if (!zgcGraphWrapEl || !zgcLinksEl || !zgcCoreEl || !zgcDomainEls.size) {
    return;
  }

  const wrapRect = zgcGraphWrapEl.getBoundingClientRect();
  const coreRect = zgcCoreEl.getBoundingClientRect();
  if (wrapRect.width <= 0 || wrapRect.height <= 0 || coreRect.width <= 0 || coreRect.height <= 0) {
    return;
  }

  const coreCenter = {
    x: coreRect.left - wrapRect.left + coreRect.width / 2,
    y: coreRect.top - wrapRect.top + coreRect.height / 2
  };
  const coreRadius = Math.max(coreRect.width, coreRect.height) / 2;
  const edgePadding = 4;
  const nodeGap = 10;
  const coreGap = 12;
  const minLayoutScale = 0.56;
  const scaleStep = 0.04;

  const layoutNodes = ZGC_DOMAIN_DEFS.map((def) => {
    const node = zgcDomainEls.get(def.key);
    const link = zgcDomainLinkEls.get(def.key);
    if (!node || !link) {
      return null;
    }
    const baseRadius = Math.max(node.offsetWidth, node.offsetHeight) / 2;
    return {
      key: def.key,
      node,
      link,
      targetX: (def.x / 100) * wrapRect.width,
      targetY: (def.y / 100) * wrapRect.height,
      baseRadius
    };
  }).filter(Boolean);

  if (!layoutNodes.length) {
    return;
  }

  let best = null;
  for (let scale = 1; scale >= minLayoutScale; scale -= scaleStep) {
    const attempt = resolveDomainLayout({
      layoutNodes,
      width: wrapRect.width,
      height: wrapRect.height,
      coreCenter,
      coreRadius,
      edgePadding,
      nodeGap,
      coreGap,
      radiusScale: scale * ZGC_DOMAIN_MAX_STRENGTH_SCALE
    });

    attempt.layoutScale = scale;
    if (!best || attempt.maxOverlapPx < best.maxOverlapPx) {
      best = attempt;
    }
    if (attempt.maxOverlapPx <= 0.5) {
      best = attempt;
      break;
    }
  }

  if (!best) {
    return;
  }

  zgcGraphWrapEl.style.setProperty("--zgc-domain-layout-scale", best.layoutScale.toFixed(3));
  const coreXPercent = (coreCenter.x / wrapRect.width) * 100;
  const coreYPercent = (coreCenter.y / wrapRect.height) * 100;

  for (const placement of best.positions) {
    const domain = layoutNodes.find((item) => item.key === placement.key);
    if (!domain) {
      continue;
    }
    const xPercent = THREE.MathUtils.clamp((placement.x / wrapRect.width) * 100, 0, 100);
    const yPercent = THREE.MathUtils.clamp((placement.y / wrapRect.height) * 100, 0, 100);
    domain.node.style.setProperty("--x", xPercent.toFixed(3));
    domain.node.style.setProperty("--y", yPercent.toFixed(3));
    domain.link.setAttribute("x1", coreXPercent.toFixed(3));
    domain.link.setAttribute("y1", coreYPercent.toFixed(3));
    domain.link.setAttribute("x2", xPercent.toFixed(3));
    domain.link.setAttribute("y2", yPercent.toFixed(3));
  }
}

function resolveDomainLayout({
  layoutNodes,
  width,
  height,
  coreCenter,
  coreRadius,
  edgePadding,
  nodeGap,
  coreGap,
  radiusScale
}) {
  const positions = layoutNodes.map((item) => ({
    key: item.key,
    x: item.targetX,
    y: item.targetY,
    targetX: item.targetX,
    targetY: item.targetY,
    radius: item.baseRadius * radiusScale
  }));

  const clampToBounds = (node) => {
    const minX = edgePadding + node.radius;
    const maxX = width - edgePadding - node.radius;
    const minY = edgePadding + node.radius;
    const maxY = height - edgePadding - node.radius;
    node.x = minX > maxX ? width / 2 : THREE.MathUtils.clamp(node.x, minX, maxX);
    node.y = minY > maxY ? height / 2 : THREE.MathUtils.clamp(node.y, minY, maxY);
  };

  for (const node of positions) {
    clampToBounds(node);
  }

  const iterations = 210;
  for (let step = 0; step < iterations; step += 1) {
    let movedPx = 0;

    for (const node of positions) {
      const pull = 0.034;
      node.x += (node.targetX - node.x) * pull;
      node.y += (node.targetY - node.y) * pull;
    }

    for (const node of positions) {
      const dx = node.x - coreCenter.x;
      const dy = node.y - coreCenter.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = node.radius + coreRadius + coreGap;
      if (dist < minDist) {
        const push = minDist - dist;
        const ux = dx / dist;
        const uy = dy / dist;
        node.x += ux * push;
        node.y += uy * push;
        movedPx += push;
      }
    }

    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const first = positions[i];
        const second = positions[j];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = first.radius + second.radius + nodeGap;
        if (dist < minDist) {
          const overlap = (minDist - dist) * 0.5;
          const ux = dx / dist;
          const uy = dy / dist;
          first.x -= ux * overlap;
          first.y -= uy * overlap;
          second.x += ux * overlap;
          second.y += uy * overlap;
          movedPx += overlap * 2;
        }
      }
    }

    for (const node of positions) {
      const beforeX = node.x;
      const beforeY = node.y;
      clampToBounds(node);
      movedPx += Math.abs(node.x - beforeX) + Math.abs(node.y - beforeY);
    }

    if (movedPx <= 0.05) {
      break;
    }
  }

  let maxOverlapPx = 0;
  for (const node of positions) {
    const dx = node.x - coreCenter.x;
    const dy = node.y - coreCenter.y;
    const dist = Math.hypot(dx, dy);
    const coreOverlap = node.radius + coreRadius + coreGap - dist;
    maxOverlapPx = Math.max(maxOverlapPx, coreOverlap);
  }

  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const first = positions[i];
      const second = positions[j];
      const dist = Math.hypot(second.x - first.x, second.y - first.y);
      const pairOverlap = first.radius + second.radius + nodeGap - dist;
      maxOverlapPx = Math.max(maxOverlapPx, pairOverlap);
    }
  }

  return {
    positions,
    maxOverlapPx
  };
}

function normalizeDomainKey(rawDomain) {
  const safeDomain = normalizeDisplayText(rawDomain, "");
  if (!safeDomain) {
    return null;
  }
  return ZGC_DOMAIN_ALIAS_MAP[safeDomain] ?? null;
}

function collectDomainKeys(expertises) {
  const keys = [];
  const seen = new Set();
  const safeExpertises = Array.isArray(expertises) ? expertises : [];
  for (const domain of safeExpertises) {
    const key = normalizeDomainKey(domain);
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

function getDomainLabel(domainKey) {
  return ZGC_DOMAIN_DEFS.find((item) => item.key === domainKey)?.label.replace(/\n/g, " ");
}

function resetZgcNetworkProgress() {
  clearZgcJoinTimers();
  for (const domain of ZGC_DOMAIN_DEFS) {
    zgcDomainLevels.set(domain.key, 0);
    updateZgcDomainVisual(domain.key);
  }
  renderZgcEmptyActivity("新一轮人员加入即将开始...");
}

function updateZgcDomainVisual(domainKey) {
  const node = zgcDomainEls.get(domainKey);
  const link = zgcDomainLinkEls.get(domainKey);
  const level = zgcDomainLevels.get(domainKey) ?? 0;
  const strength = THREE.MathUtils.clamp(level / 6, 0, 1);

  if (node) {
    node.style.setProperty("--strength", strength.toFixed(3));
  }

  if (link) {
    const strokeR = Math.round(246 + strength * 9);
    const strokeG = Math.round(192 + strength * 36);
    const strokeB = Math.round(118 + strength * 56);
    const opacity = (0.56 + strength * 0.36).toFixed(3);
    const glow = (4 + strength * 12).toFixed(2);
    link.style.stroke = `rgba(${strokeR}, ${strokeG}, ${strokeB}, ${opacity})`;
    link.style.strokeWidth = (1.45 + strength * 2.2).toFixed(2);
    link.style.filter = `drop-shadow(0 0 ${glow}px rgba(255, 181, 101, ${0.38 + strength * 0.42}))`;
  }
}

function pulseZgcCore() {
  if (!zgcCoreEl) {
    return;
  }
  zgcCoreEl.classList.remove("core-pulse");
  void zgcCoreEl.offsetWidth;
  zgcCoreEl.classList.add("core-pulse");
}

function boostZgcDomains(expertises) {
  const keys = collectDomainKeys(expertises);
  if (!keys.length) {
    return;
  }

  for (const key of keys) {
    const current = zgcDomainLevels.get(key) ?? 0;
    zgcDomainLevels.set(key, Math.min(7, current + 1));
    updateZgcDomainVisual(key);
  }
  pulseZgcCore();
}

function clearZgcJoinTimers() {
  for (const timerId of zgcJoinTimers) {
    clearTimeout(timerId);
  }
  zgcJoinTimers = [];
  if (zgcJoinLayerEl) {
    zgcJoinLayerEl.replaceChildren();
  }
}

function buildActivityKey(groupDate, globalIndex, localIndex) {
  return `${groupDate}:${globalIndex}:${localIndex}`;
}

function renderZgcEmptyActivity(text) {
  if (!zgcActivityListEl) {
    return;
  }
  zgcActivityEls.clear();
  const hint = document.createElement("div");
  hint.className = "zgcActivityItem";
  const name = document.createElement("p");
  name.className = "zgcActivityName";
  name.textContent = normalizeDisplayText(text, "等待成员加入...");
  hint.appendChild(name);
  zgcActivityListEl.replaceChildren(hint);
}

function renderZgcActivities(group) {
  if (!zgcActivityListEl) {
    return;
  }

  const photos = group?.photos ?? [];
  const indices = group?.indices ?? [];
  zgcActivityEls.clear();
  zgcActivityListEl.replaceChildren();

  if (!photos.length) {
    renderZgcEmptyActivity("本轮暂无活动");
    return;
  }

  const frag = document.createDocumentFragment();
  for (let i = 0; i < photos.length; i += 1) {
    const person = photos[i];
    const activityKey = buildActivityKey(group?.date ?? "unknown", indices[i] ?? i, i);
    const item = document.createElement("article");
    item.className = "zgcActivityItem";
    item.dataset.activityKey = activityKey;

    const name = document.createElement("p");
    name.className = "zgcActivityName";
    name.textContent = normalizeDisplayText(person?.name, "未命名成员");

    const meta = document.createElement("p");
    meta.className = "zgcActivityMeta";
    const date = normalizeDisplayText(person?.date, group?.date ?? "日期未设置");
    const city = normalizeDisplayText(person?.originCity, "来源地未设置");
    meta.textContent = `${date} · ${city}`;

    const tags = document.createElement("div");
    tags.className = "zgcTagRow";
    const domains = collectDomainKeys(person?.expertises);
    const displayDomains = domains.length
      ? domains.map((key) => getDomainLabel(key)).filter(Boolean)
      : ["未标注领域"];

    for (const domainLabel of displayDomains) {
      const tag = document.createElement("span");
      tag.className = "zgcTag";
      tag.textContent = domainLabel;
      tags.appendChild(tag);
    }

    item.append(name, meta, tags);
    frag.appendChild(item);
    zgcActivityEls.set(activityKey, item);
  }

  zgcActivityListEl.appendChild(frag);
  zgcActivityListEl.scrollTop = 0;
}

function markZgcActivityJoined(activityKey) {
  const activityEl = zgcActivityEls.get(activityKey);
  if (!activityEl) {
    return;
  }
  activityEl.classList.add("joined");
}

function getZgcJoinStartPoint(order, total) {
  const totalCount = Math.max(total, 1);
  const baseAngle = (order / totalCount) * Math.PI * 2 - Math.PI * 0.34;
  const jitterAngle = (Math.random() - 0.5) * 0.26;
  const jitterRadius = (Math.random() - 0.5) * 5.2;
  const radiusX = 42 + jitterRadius;
  const radiusY = 38 + jitterRadius * 0.72;
  const x = ZGC_CORE_POINT.x + Math.cos(baseAngle + jitterAngle) * radiusX;
  const y = ZGC_CORE_POINT.y + Math.sin(baseAngle + jitterAngle) * radiusY;
  return {
    x: THREE.MathUtils.clamp(x, 4, 96),
    y: THREE.MathUtils.clamp(y, 6, 96)
  };
}

function spawnZgcJoinAvatar(person, order, total) {
  if (!zgcJoinLayerEl) {
    return;
  }

  const start = getZgcJoinStartPoint(order, total);
  const avatar = document.createElement("div");
  avatar.className = "zgcJoinAvatar";
  avatar.style.left = `${start.x}%`;
  avatar.style.top = `${start.y}%`;

  const img = document.createElement("img");
  img.src = person?.src || "";
  img.alt = `${normalizeDisplayText(person?.name, "成员")} 飞入`;
  const focus = resolvePhotoFocus(person);
  img.style.objectPosition = `${focus.x}% ${focus.y}%`;
  avatar.appendChild(img);

  zgcJoinLayerEl.appendChild(avatar);

  requestAnimationFrame(() => {
    avatar.style.opacity = "0.95";
    avatar.style.left = `${ZGC_CORE_POINT.x}%`;
    avatar.style.top = `${ZGC_CORE_POINT.y}%`;
    avatar.style.transform = "translate(-50%, -50%) scale(0.26)";
  });

  const fadeTimer = window.setTimeout(() => {
    avatar.style.opacity = "0.06";
    avatar.style.transform = "translate(-50%, -50%) scale(0.14)";
  }, 1160);
  const removeTimer = window.setTimeout(() => {
    avatar.remove();
  }, 2320);
  zgcJoinTimers.push(fadeTimer, removeTimer);
}

function playZgcGroupJoinSequence(group, cycleId) {
  const photos = group?.photos ?? [];
  const indices = group?.indices ?? [];
  const sequenceToken = zgcJoinSequenceToken + 1;
  zgcJoinSequenceToken = sequenceToken;
  clearZgcJoinTimers();
  renderZgcActivities(group);

  if (!photos.length) {
    return;
  }

  for (let i = 0; i < photos.length; i += 1) {
    const person = photos[i];
    const activityKey = buildActivityKey(group?.date ?? "unknown", indices[i] ?? i, i);
    const queueDelay = 240 + i * 520;
    const launchTimer = window.setTimeout(() => {
      if (cycleId !== cycleToken || sequenceToken !== zgcJoinSequenceToken) {
        return;
      }

      spawnZgcJoinAvatar(person, i, photos.length);

      const settleTimer = window.setTimeout(() => {
        if (cycleId !== cycleToken || sequenceToken !== zgcJoinSequenceToken) {
          return;
        }
        markZgcActivityJoined(activityKey);
        boostZgcDomains(person?.expertises);
      }, 860);
      zgcJoinTimers.push(settleTimer);
    }, queueDelay);

    zgcJoinTimers.push(launchTimer);
  }
}

function normalizeDisplayText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, "").trim();
  const lowered = unquoted.toLowerCase();
  if (!unquoted || lowered === "undefined" || lowered === "null" || lowered === "nan") {
    return fallback;
  }

  return trimmed;
}

function buildPhotoGroups(photos) {
  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < photos.length; i += 1) {
    const photo = photos[i];
    const date = normalizeDisplayText(photo?.date, "unknown-date");
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

function renderNameIntro(container, names, className) {
  if (!container) {
    return;
  }

  const normalizedNames = (Array.isArray(names) ? names : [])
    .map((item) => normalizeDisplayText(item, ""))
    .filter(Boolean);

  if (!normalizedNames.length) {
    container.textContent = "";
    return;
  }

  if (normalizedNames.length === 1) {
    container.textContent = normalizedNames[0];
    return;
  }

  container.textContent = "";
  const frag = document.createDocumentFragment();
  for (const name of normalizedNames) {
    const line = document.createElement("span");
    line.className = className;
    line.textContent = name;
    frag.appendChild(line);
  }
  container.appendChild(frag);
}

function renderGroupIntroCards(photos) {
  if (!photoCardsEl) {
    return;
  }

  photoCardsEl.replaceChildren();
  const normalizedPhotos = (Array.isArray(photos) ? photos : []).filter(Boolean);
  if (normalizedPhotos.length <= 1) {
    return;
  }

  const frag = document.createDocumentFragment();
  for (const person of normalizedPhotos) {
    const card = document.createElement("div");
    card.className = "photoIntroCard";

    const frame = document.createElement("div");
    frame.className = "photoIntroCardFrame";

    const img = document.createElement("img");
    img.className = "photoIntroCardImage";
    img.src = person.src;
    const focus = resolvePhotoFocus(person);
    img.style.objectPosition = `${focus.x}% ${focus.y}%`;
    img.alt = normalizeDisplayText(person?.name, "未命名成员");
    frame.appendChild(img);

    const name = document.createElement("div");
    name.className = "photoIntroCardName";
    name.textContent = normalizeDisplayText(person?.name, "未命名成员");

    card.append(frame, name);
    frag.appendChild(card);
  }

  photoCardsEl.appendChild(frag);
}

async function applyActivePhoto() {
  const activeGroup = getActiveGroup();
  const photo = getActivePhoto();
  if (!photo) {
    return;
  }

  const safeNames = (activeGroup?.photos ?? [photo])
    .map((item) => normalizeDisplayText(item?.name, "未命名成员"))
    .filter(Boolean);
  const safeName = safeNames[0] ?? "未命名成员";
  const nameText = safeNames.length > 1 ? safeNames.join("、") : safeName;

  const safeOrigins = (activeGroup?.photos ?? [photo])
    .map((item) => normalizeDisplayText(item?.originCity, "来源地未设置"))
    .filter(Boolean);
  const uniqueOrigins = [...new Set(safeOrigins)];
  const safeOrigin = uniqueOrigins[0] ?? "来源地未设置";
  const safeDate = normalizeDisplayText(photo.date, "日期未设置");
  const hasMultiPeople = (activeGroup?.photos?.length ?? 0) > 1;

  const stagePhotoSrc = hasMultiPeople ? photo.src : await resolveStagePhotoSrc(activeGroup, photo);
  photoEl.src = stagePhotoSrc;
  const focus = resolvePhotoFocus(photo);
  photoEl.style.objectPosition = `${focus.x}% ${focus.y}%`;
  photoEl.alt = `${nameText}（${safeOrigin}，入职 ${safeDate}）`;
  photoStage.classList.toggle("group-intro", hasMultiPeople);
  renderGroupIntroCards(activeGroup?.photos ?? [photo]);
  if (hasMultiPeople) {
    photoNameEl.textContent = "";
  } else {
    renderNameIntro(photoNameEl, safeNames, "photoNameItem");
  }
  renderNameIntro(cornerNameEl, safeNames, "cornerNameItem");

  const hudHint = document.querySelector("#hud p");
  if (hudHint) {
    const modeText = ROUTE_VIEW_MODE === "two-stage" ? "双阶段" : "单地图";
    const memberCount = activeGroup?.photos?.length ?? 1;
    const originText =
      uniqueOrigins.length > 1 ? `${safeOrigin} 等${uniqueOrigins.length}地` : safeOrigin;
    const whoText = memberCount > 1 ? nameText : safeName;
    hudHint.textContent = `${safeDate} · ${whoText} · ${originText} → 北京市（${modeText}） · 拖拽旋转 · 滚轮缩放`;
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

function clearMorphCompleteTimer() {
  if (morphCompleteTimerId) {
    clearTimeout(morphCompleteTimerId);
    morphCompleteTimerId = 0;
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
  clearMorphCompleteTimer();
  clearMorphTargetThumb();

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

  photoStage.style.display = "";
  photoStage.classList.remove("done", "morphing");
  resetPhotoMorphTransform();

  if (poiLabel) {
    poiLabel.classList.remove("show");
    poiLabel.style.transform = "translate(-9999px, -9999px)";
  }

  controls.enabled = false;
  controls.autoRotate = false;
  controls.minDistance = 34;
  controls.maxDistance = 108;
  setMapToggleEnabled(false);

  await applyActivePhoto();
  if (token !== cycleToken) {
    return;
  }
  playZgcGroupJoinSequence(activeGroup, token);

  const startMapMode = getGroupStartMapMode(activeGroup);
  await switchMap(startMapMode, { force: true });
  if (token !== cycleToken) {
    return;
  }

  camera.position.copy(CAMERA_HOME);
  controls.target.copy(CONTROL_HOME);
  camera.lookAt(controls.target);
  controls.update();

  runIntroSequence();
}

async function switchMap(mapMode, { force = false } = {}) {
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
      addOriginMarker(photo.originCoord, idx, visiblePhotos.length, photo, {
        useThumbnail: true
      })
    );
    currentMapMode = mapMode;
    updateMapToggleState();

    updatePoiLabelPosition();
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
    position: "absolute",
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
  (leftPaneEl ?? document.body).appendChild(panel);
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

  const icon = createHaidianMarkerIcon();
  marker.add(icon);

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

function createHaidianMarkerIcon() {
  const icon = new THREE.Group();

  const fallbackCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffdda2,
      emissive: 0x5b300d,
      emissiveIntensity: 0.82,
      roughness: 0.42,
      metalness: 0.24
    })
  );
  fallbackCore.position.y = 0.62;
  icon.add(fallbackCore);

  const baseHeight = 3.2;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaTest: 0.04
    })
  );
  sprite.center.set(0.5, 0.03);
  sprite.position.y = 0.02;
  sprite.scale.set(baseHeight * 0.88, baseHeight, 1);
  sprite.renderOrder = 16;
  icon.add(sprite);

  markerTextureLoader.load(
    HAIDIAN_MARKER_ICON_SRC,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      sprite.material.map = texture;
      sprite.material.opacity = 1;
      sprite.material.needsUpdate = true;
      fallbackCore.visible = false;

      const image = texture.image;
      if (image && image.width && image.height) {
        const aspect = image.width / image.height;
        sprite.scale.set(baseHeight * aspect, baseHeight, 1);
      }
    },
    undefined,
    () => {
      console.warn(`[marker] 聚合点图标加载失败: ${HAIDIAN_MARKER_ICON_SRC}`);
    }
  );

  return icon;
}

function addOriginMarker(coord, order = 0, total = 1, photo = null, options = {}) {
  const { useThumbnail = false } = options;
  const marker = new THREE.Group();
  marker.position.copy(lonLatToLocalPosition(coord, 0.26));

  if (total > 1) {
    const angle = (order / total) * Math.PI * 2;
    const radius = Math.min(0.42, 0.12 * total);
    marker.position.x += Math.cos(angle) * radius;
    marker.position.z += Math.sin(angle) * radius;
  }

  const icon =
    useThumbnail && photo?.src ? createOriginThumbnailIcon(photo.src) : createOriginDotIcon();
  marker.add(icon);

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

function createOriginDotIcon() {
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xaed8ff })
  );
  return core;
}

function createOriginThumbnailIcon(photoSrc) {
  const icon = new THREE.Group();
  const fallbackCore = createOriginDotIcon();
  icon.add(fallbackCore);

  const baseHeight = 2.05;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaTest: 0.04
    })
  );
  sprite.center.set(0.5, 0.08);
  sprite.position.y = 0.03;
  sprite.scale.set(baseHeight * 0.86, baseHeight, 1);
  sprite.renderOrder = 15;
  icon.add(sprite);

  markerTextureLoader.load(
    photoSrc,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      sprite.material.map = texture;
      sprite.material.opacity = 1;
      sprite.material.needsUpdate = true;
      fallbackCore.visible = false;

      const image = texture.image;
      if (image && image.width && image.height) {
        const aspect = image.width / image.height;
        const clampedAspect = THREE.MathUtils.clamp(aspect, 0.62, 1.45);
        sprite.scale.set(baseHeight * clampedAspect, baseHeight, 1);
      }
    },
    undefined,
    () => {
      console.warn(`[marker] 来源缩略图加载失败: ${photoSrc}`);
    }
  );

  return icon;
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

function resetPhotoMorphTransform() {
  photoStage.style.setProperty("--photo-morph-x", "0px");
  photoStage.style.setProperty("--photo-morph-y", "0px");
  photoStage.style.setProperty("--photo-morph-scale", "1");
}

function createMorphTargetThumb(photoIndex = activePhotoIndex) {
  if (!photoThumbDock) {
    return null;
  }

  const photo = PHOTO_SET[photoIndex];
  if (!photo) {
    return null;
  }

  clearMorphTargetThumb();

  const thumbKey = `${photoIndex}:${photo.src}`;
  const thumb = document.createElement("div");
  thumb.className = "photoThumb photoThumbTarget";
  thumb.setAttribute("aria-hidden", "true");
  thumb.dataset.thumbKey = thumbKey;

  const img = document.createElement("img");
  img.src = photo.src;
  const focus = resolvePhotoFocus(photo);
  img.style.objectPosition = `${focus.x}% ${focus.y}%`;
  img.alt = `${normalizeDisplayText(photo.name, "未命名成员")} 缩略图`;
  thumb.appendChild(img);

  photoThumbDock.appendChild(thumb);
  morphTargetThumbEl = thumb;
  return thumb;
}

function clearMorphTargetThumb() {
  if (!morphTargetThumbEl) {
    return;
  }

  morphTargetThumbEl.remove();
  morphTargetThumbEl = null;
}

function updatePhotoMorphTransform() {
  const thumb = morphTargetThumbEl ?? createMorphTargetThumb();
  if (!thumb) {
    resetPhotoMorphTransform();
    return;
  }

  const photoRect = getPhotoRect();
  const thumbRect = thumb.getBoundingClientRect();
  if (thumbRect.width <= 0 || thumbRect.height <= 0) {
    resetPhotoMorphTransform();
    return;
  }

  const photoCenterX = photoRect.x + photoRect.width / 2;
  const photoCenterY = photoRect.y + photoRect.height / 2;
  const thumbCenterX = thumbRect.left + thumbRect.width / 2;
  const thumbCenterY = thumbRect.top + thumbRect.height / 2;

  const dx = thumbCenterX - photoCenterX;
  const dy = thumbCenterY - photoCenterY;
  const scale = THREE.MathUtils.clamp(thumbRect.width / Math.max(photoRect.width, 1), 0.08, 1);

  photoStage.style.setProperty("--photo-morph-x", `${dx.toFixed(3)}px`);
  photoStage.style.setProperty("--photo-morph-y", `${dy.toFixed(3)}px`);
  photoStage.style.setProperty("--photo-morph-scale", `${scale.toFixed(4)}`);
}

function runIntroSequence() {
  morphState.startedAt = performance.now();
  createMorphTargetThumb();
  updatePhotoMorphTransform();

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

  if (morphTargetThumbEl && morphTargetThumbEl.dataset.thumbKey === thumbKey) {
    const reusedThumb = morphTargetThumbEl;
    reusedThumb.classList.remove("photoThumbTarget");
    capturedThumbs.add(thumbKey);
    morphTargetThumbEl = null;
    return;
  }

  const thumb = document.createElement("div");
  thumb.className = "photoThumb fresh";
  thumb.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.src = photo.src;
  const focus = resolvePhotoFocus(photo);
  img.style.objectPosition = `${focus.x}% ${focus.y}%`;
  img.alt = `${normalizeDisplayText(photo.name, "未命名成员")} 缩略图`;
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
  clearMorphTargetThumb();
  if (photoThumbDock) {
    photoThumbDock.replaceChildren();
  }
}

function drawMorphFrame(now) {
  if (morphState.done || morphState.startedAt <= 0) {
    return;
  }

  const elapsed = now - morphState.startedAt;

  if (elapsed < morphState.holdMs) {
    return;
  }

  if (!morphState.active) {
    morphState.active = true;
    updatePhotoMorphTransform();
    photoStage.classList.add("morphing");
  }

  const tRaw = (elapsed - morphState.holdMs) / morphState.morphMs;
  const t = THREE.MathUtils.clamp(tRaw, 0, 1);

  if (t >= 1) {
    morphState.done = true;
    photoStage.classList.remove("morphing");
    photoStage.classList.add("done");

    const doneToken = cycleToken;
    clearMorphCompleteTimer();
    morphCompleteTimerId = window.setTimeout(() => {
      morphCompleteTimerId = 0;
      if (doneToken !== cycleToken) {
        return;
      }
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

function buildRouteFlightEntry(start, end, order = 0, total = 1, photo = null) {
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

  const mover = createRouteAvatarMover(photo, color, order);
  mover.position.copy(p0);
  mapRoot.add(mover);

  return { p0, p1, p2, p3, mover, trail, spinOffset: mover.userData.spinOffset ?? 0 };
}

function createRouteAvatarMover(photo, accentColor, order = 0) {
  const mover = new THREE.Group();
  mover.userData.spinOffset = order * 0.86 + Math.random() * Math.PI;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.052, 10, 48),
    new THREE.MeshBasicMaterial({
      color: 0xaecfff,
      transparent: true,
      opacity: 0.54,
      depthWrite: false
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  mover.add(ring);
  mover.userData.ring = ring;

  const trailingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.038, 8, 40),
    new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  );
  trailingRing.rotation.x = Math.PI / 2;
  trailingRing.position.set(0.24, 0.06, -0.18);
  mover.add(trailingRing);
  mover.userData.trailingRing = trailingRing;

  const avatarRig = new THREE.Group();
  avatarRig.position.y = 0.94;
  mover.add(avatarRig);
  mover.userData.avatarRig = avatarRig;

  const baseHeight = 1.46;
  const shadow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.24,
      depthWrite: false
    })
  );
  shadow.center.set(0.5, 0.5);
  shadow.position.set(0.06, -0.05, -0.06);
  shadow.scale.set(baseHeight * 0.78, baseHeight * 1.04, 1);
  avatarRig.add(shadow);

  const fallbackCore = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xb0d5ff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    })
  );
  fallbackCore.center.set(0.5, 0.06);
  fallbackCore.scale.set(baseHeight * 0.82, baseHeight, 1);
  avatarRig.add(fallbackCore);

  const avatar = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaTest: 0.04
    })
  );
  avatar.center.set(0.5, 0.06);
  avatar.scale.set(baseHeight * 0.82, baseHeight, 1);
  avatar.position.z = 0.01;
  avatarRig.add(avatar);

  const photoSrc = photo?.src;
  if (!photoSrc) {
    return mover;
  }

  markerTextureLoader.load(
    photoSrc,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      avatar.material.map = texture;
      avatar.material.opacity = 1;
      avatar.material.needsUpdate = true;
      fallbackCore.visible = false;

      const image = texture.image;
      if (image && image.width && image.height) {
        const aspect = image.width / image.height;
        const clampedAspect = THREE.MathUtils.clamp(aspect, 0.6, 1.2);
        avatar.scale.set(baseHeight * clampedAspect, baseHeight, 1);
      }
    },
    undefined,
    () => {
      console.warn(`[marker] 路径头像加载失败: ${photoSrc}`);
    }
  );

  return mover;
}

function startChinaFlightToBeijing(startTime = performance.now()) {
  if (currentMapMode !== "china" || !originMarkers.length || !beijingMarker) {
    return false;
  }

  clearRouteFlightVisuals();
  const visiblePhotos = getPhotosForCurrentMap("china").filter((photo) => photo?.originCoord);

  routeFlight.flights = originMarkers.map((originMarker, idx) =>
    buildRouteFlightEntry(
      originMarker.position,
      beijingMarker.position,
      idx,
      originMarkers.length,
      visiblePhotos[idx] ?? null
    )
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
  const visiblePhotos = getPhotosForCurrentMap("beijing").filter((photo) => photo?.originCoord);

  routeFlight.flights = originMarkers.map((originMarker, idx) =>
    buildRouteFlightEntry(
      originMarker.position,
      haidianMarker.position,
      idx,
      originMarkers.length,
      visiblePhotos[idx] ?? null
    )
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
    const spinOffset = flight.spinOffset ?? 0;
    flight.mover.position.y += Math.sin(now * 0.008 + spinOffset) * 0.06;

    cubicBezierVec3(
      flight.p0,
      flight.p1,
      flight.p2,
      flight.p3,
      Math.min(1, eased + 0.018),
      routeTempAhead
    );
    routeTempHeading.subVectors(routeTempAhead, routeTempPoint);
    routeTempHeading.y = 0;
    if (routeTempHeading.lengthSq() > 1e-6) {
      flight.mover.rotation.y = Math.atan2(routeTempHeading.x, routeTempHeading.z);
    }

    const avatarRig = flight.mover.userData.avatarRig;
    if (avatarRig) {
      avatarRig.rotation.y = Math.sin(now * 0.0045 + spinOffset) * 0.45;
    }

    const ring = flight.mover.userData.ring;
    if (ring) {
      ring.scale.setScalar(1 + Math.sin(now * 0.008 + spinOffset) * 0.1);
      ring.material.opacity = 0.46 + Math.sin(now * 0.007 + spinOffset) * 0.18;
    }

    const trailingRing = flight.mover.userData.trailingRing;
    if (trailingRing) {
      trailingRing.scale.setScalar(1 + Math.sin(now * 0.009 + spinOffset + 0.7) * 0.12);
      trailingRing.material.opacity = 0.3 + Math.sin(now * 0.0075 + spinOffset + 0.9) * 0.14;
    }

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

  if (!shouldFocusAggregationMarkerNow()) {
    skipAggregationMarkerFocusAndContinue();
    return;
  }

  if (ROUTE_VIEW_MODE === "two-stage" && currentMapMode !== "beijing") {
    stage2TransitionPending = true;
    switchMap("beijing", { force: true })
      .then(() => {
        startHaidianFlyIn(performance.now());
      })
      .catch((err) => {
        console.error(err);
        recoverFromStage2TransitionFailure();
      })
      .finally(() => {
        stage2TransitionPending = false;
      });
    return;
  }

  startHaidianFlyIn(startTime);
}

function shouldFocusAggregationMarkerNow() {
  const activeGroup = getActiveGroup();
  if (!activeGroup?.indices?.length || !PHOTO_SET.length) {
    return false;
  }

  const lastIndexInGroup = activeGroup.indices[activeGroup.indices.length - 1];
  return lastIndexInGroup >= PHOTO_SET.length - 1;
}

function skipAggregationMarkerFocusAndContinue() {
  cameraFlight.active = false;
  cameraFlight.completed = false;
  controls.enabled = true;
  controls.autoRotate = !userMoved;
  setMapToggleEnabled(true);
  updateMapToggleState();
  queueNextPhotoCycle();
}

function recoverFromStage2TransitionFailure() {
  cameraFlight.active = false;
  cameraFlight.completed = false;
  controls.enabled = true;
  controls.autoRotate = !userMoved;
  setMapToggleEnabled(true);
  updateMapToggleState();
  queueNextPhotoCycle();
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
      resetZgcNetworkProgress();
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
  const sceneSize = getSceneSize();
  const x = (projected.x * 0.5 + 0.5) * sceneSize.width;
  const y = (-projected.y * 0.5 + 0.5) * sceneSize.height;
  poiLabel.style.transform = `translate(${x}px, ${y}px) translate(24px, -58px)`;
}

function drawImageCover(ctx, image, dx, dy, dw, dh, focus = { x: 50, y: 50 }) {
  const iw = image.naturalWidth || image.width || 1;
  const ih = image.naturalHeight || image.height || 1;
  const scale = Math.max(dw / iw, dh / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const fx = THREE.MathUtils.clamp((focus?.x ?? 50) / 100, 0, 1);
  const fy = THREE.MathUtils.clamp((focus?.y ?? 50) / 100, 0, 1);
  const offsetX = dx + (dw - drawW) * fx;
  const offsetY = dy + (dh - drawH) * fy;
  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
}

function resolvePhotoFocus(photo) {
  return {
    x: resolvePercent(photo?.focus?.x, 50),
    y: resolvePercent(photo?.focus?.y, 50)
  };
}

function resolvePercent(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return THREE.MathUtils.clamp(parsed, 0, 100);
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}

function getStageCollageLayout(count) {
  if (count <= 1) {
    return { cols: 1, rows: 1 };
  }

  if (count === 2) {
    return { cols: 2, rows: 1 };
  }

  const cols = Math.min(3, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

async function resolveStagePhotoSrc(group, fallbackPhoto) {
  const photos = group?.photos?.length ? group.photos : fallbackPhoto ? [fallbackPhoto] : [];
  if (!photos.length) {
    return fallbackPhoto?.src ?? "";
  }

  if (photos.length === 1) {
    return photos[0].src;
  }

  const cacheKey = photos.map((photo) => photo?.src ?? "").join("|");
  if (groupStagePhotoSrcCache.has(cacheKey)) {
    return groupStagePhotoSrcCache.get(cacheKey);
  }

  const stageWidth = 900;
  const stageHeight = 1200;
  const gap = 14;
  const canvas = document.createElement("canvas");
  canvas.width = stageWidth;
  canvas.height = stageHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return photos[0].src;
  }

  const loaded = await Promise.all(
    photos.map(async (photo) => {
      try {
        return await loadImageElement(photo.src);
      } catch {
        return null;
      }
    })
  );

  ctx.fillStyle = "#1c1208";
  ctx.fillRect(0, 0, stageWidth, stageHeight);

  const { cols, rows } = getStageCollageLayout(photos.length);
  const cellW = (stageWidth - gap * (cols + 1)) / cols;
  const cellH = (stageHeight - gap * (rows + 1)) / rows;

  for (let i = 0; i < photos.length; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (row >= rows) {
      break;
    }

    const x = gap + col * (cellW + gap);
    const y = gap + row * (cellH + gap);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();

    const image = loaded[i];
    if (image) {
      drawImageCover(ctx, image, x, y, cellW, cellH, resolvePhotoFocus(photos[i]));
    } else {
      ctx.fillStyle = "#3d2813";
      ctx.fillRect(x, y, cellW, cellH);
      ctx.fillStyle = "#f2d29a";
      ctx.font = "600 34px 'Noto Serif SC', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fallbackName = normalizeDisplayText(photos[i]?.name, "成员");
      ctx.fillText(fallbackName, x + cellW / 2, y + cellH / 2);
    }

    ctx.restore();
  }

  ctx.strokeStyle = "rgba(231, 197, 130, 0.42)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, stageWidth - 6, stageHeight - 6);

  const compositeSrc = canvas.toDataURL("image/jpeg", 0.92);
  groupStagePhotoSrcCache.set(cacheKey, compositeSrc);
  return compositeSrc;
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

  const sceneSize = getSceneSize();
  const width = Math.max(150, Math.min(sceneSize.width * 0.38, 320));
  const height = width / 0.75;
  return {
    x: (sceneSize.width - width) / 2,
    y: (sceneSize.height - height) / 2,
    width,
    height
  };
}

function onResize() {
  const sceneSize = getSceneSize();
  renderer.setSize(sceneSize.width, sceneSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  camera.aspect = sceneSize.width / sceneSize.height;
  camera.updateProjectionMatrix();

  if (!morphState.done) {
    updatePhotoMorphTransform();
  }

  updatePoiLabelPosition();
  layoutZgcDomainNodes();
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
