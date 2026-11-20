// VICE FRAME 5 — editor.
//
// Owns the working model, the photo shelf, pointer interaction on the
// canvas, the control panel wiring and PNG export. All drawing is
// delegated to paint.js; all positions come from geometry.js.

import { EXPORT_SIZES, LAYOUT_DEFS, panelCountFor, measureMasthead, panelArea, shapesForLayout, shapeContains } from './geometry.js';
import { GRADE_DEFS, paintCover } from './paint.js';

const STOCK_PHOTOS = [
  { id: 'neon-marina', label: 'Neon Marina' },
  { id: 'convertible-queen', label: 'Convertible Queen' },
  { id: 'rooftop-crew', label: 'Rooftop Crew' },
  { id: 'pier-fisher', label: 'Pier Fisher' },
  { id: 'casino-strip', label: 'Casino Strip' },
  { id: 'beach-duo', label: 'Beach Duo' },
  { id: 'harbor-yacht', label: 'Harbor Yacht' },
  { id: 'diner-night', label: 'Diner Night' },
  { id: 'boardwalk-man', label: 'Boardwalk Man' },
];
// Rotation used when a layout grows and fresh panels need filling.
const FILL_ROTATION = ['neon-marina', 'casino-strip', 'diner-night', 'harbor-yacht', 'beach-duo', 'rooftop-crew'];
const GRADE_ROTATION = ['vice-sunset', 'neon-night', 'golden-hour', 'clean', 'split-tone', 'duotone-heat'];

const loadedPhotos = new Map(); // photo id -> HTMLImageElement

const model = {
  title: 'LAS LUMEN HEAT',
  tagline: 'ONE CITY. NO MERCY.',
  caption: 'THE CITY NEVER SLEEPS',
  layout: 'cover-closeup',
  sizeId: 'square',
  panels: [
    { photo: 'neon-marina', grade: 'neon-night', panX: 0, panY: 0, zoom: 1 },
    { photo: 'casino-strip', grade: 'vice-sunset', panX: 0, panY: 0, zoom: 1 },
    { photo: 'diner-night', grade: 'golden-hour', panX: 0, panY: 0, zoom: 1 },
  ],
  selected: 0,
  dressing: { palm: true, burst: true, sun: false },
  grain: true,
};

const el = (id) => document.getElementById(id);
const canvasEl = el('art');
const pen = canvasEl.getContext('2d');

function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[0];
}

function growPanels() {
  const needed = panelCountFor(model.layout);
  while (model.panels.length < needed) {
    const slot = model.panels.length;
    model.panels.push({
      photo: FILL_ROTATION[slot % FILL_ROTATION.length],
      grade: GRADE_ROTATION[slot % GRADE_ROTATION.length],
      panX: 0, panY: 0, zoom: 1,
    });
  }
  if (model.selected >= needed) model.selected = 0;
}

function activePanel() {
  return model.panels[model.selected];
}

function redraw() {
  growPanels();
  const size = sizeById(model.sizeId);
  if (canvasEl.width !== size.w) canvasEl.width = size.w;
  if (canvasEl.height !== size.h) canvasEl.height = size.h;
  paintCover(pen, model, size.w, size.h, loadedPhotos);
  syncPanelWidgets();
}

function syncPanelWidgets() {
  const panel = activePanel();
  if (!panel) return;
  el('in-grade').value = panel.grade;
  el('in-zoom').value = String(panel.zoom || 1);
}

function announce(message) {
  el('note').textContent = message;
}

// ------------------------------------------------------------ photo shelf

function shelfButton(photoId, src, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = label;
  const thumb = document.createElement('img');
  thumb.src = src;
  thumb.alt = label;
  button.appendChild(thumb);
  button.addEventListener('click', () => {
    const panel = activePanel();
    if (panel) {
      panel.photo = photoId;
      redraw();
      announce(`Panel ${model.selected + 1} now shows ${label}.`);
    }
  });
  el('shelf').appendChild(button);
}

function fetchPhoto(photoId, src, label) {
  return new Promise((done) => {
    const image = new Image();
    image.onload = () => {
      loadedPhotos.set(photoId, image);
      shelfButton(photoId, src, label);
      done();
    };
    image.onerror = () => done();
    image.src = src;
  });
}

let uploadSerial = 0;
function acceptFiles(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) continue;
    const objectUrl = URL.createObjectURL(file);
    const photoId = `upload-${++uploadSerial}`;
    fetchPhoto(photoId, objectUrl, file.name).then(() => {
      const panel = activePanel();
      if (panel) panel.photo = photoId;
      redraw();
    });
  }
}

// ------------------------------------------------------- pointer handling

function shapesNow() {
  const size = sizeById(model.sizeId);
  const scratchPen = document.createElement('canvas').getContext('2d');
  const mast = measureMasthead(scratchPen, model.title, size.w, size.h);
  const area = panelArea(mast, model.tagline, size.w, size.h);
  return shapesForLayout(model.layout, area.x, area.y, area.w, area.h);
}

function toCanvasCoords(event) {
  const box = canvasEl.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (canvasEl.width / box.width),
    y: (event.clientY - box.top) * (canvasEl.height / box.height),
  };
}

let dragState = null;
canvasEl.addEventListener('pointerdown', (event) => {
  const point = toCanvasCoords(event);
  const shapes = shapesNow();
  const hit = shapes.findIndex((s) => shapeContains(s, point.x, point.y));
  if (hit >= 0) model.selected = hit;
  dragState = { x: point.x, y: point.y };
  canvasEl.setPointerCapture(event.pointerId);
  redraw();
});
canvasEl.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const point = toCanvasCoords(event);
  const shapes = shapesNow();
  const shape = shapes[model.selected];
  const panel = activePanel();
  if (!shape || !panel) return;
  panel.panX = clampPan((panel.panX || 0) + (point.x - dragState.x) / shape.w);
  panel.panY = clampPan((panel.panY || 0) + (point.y - dragState.y) / shape.h);
  dragState = { x: point.x, y: point.y };
  redraw();
});
canvasEl.addEventListener('pointerup', () => { dragState = null; });
canvasEl.addEventListener('wheel', (event) => {
  event.preventDefault();
  const panel = activePanel();
  if (!panel) return;
  const factor = event.deltaY < 0 ? 1.06 : 1 / 1.06;
  panel.zoom = Math.min(3, Math.max(1, (panel.zoom || 1) * factor));
  redraw();
}, { passive: false });
canvasEl.addEventListener('dblclick', (event) => {
  const point = toCanvasCoords(event);
  const shapes = shapesNow();
  const hit = shapes.findIndex((s) => shapeContains(s, point.x, point.y));
  const panel = model.panels[hit >= 0 ? hit : model.selected];
  if (panel) {
    panel.panX = 0; panel.panY = 0; panel.zoom = 1;
    redraw();
    announce('Panel framing reset.');
  }
});

function clampPan(value) {
  return Math.min(0.6, Math.max(-0.6, value));
}

window.addEventListener('keydown', (event) => {
  const focusTag = document.activeElement?.tagName;
  if (focusTag === 'INPUT' || focusTag === 'SELECT' || focusTag === 'TEXTAREA') return;
  const panel = activePanel();
  if (!panel) return;
  const stride = event.shiftKey ? 0.05 : 0.012;
  if (event.key === 'ArrowLeft') panel.panX = clampPan((panel.panX || 0) - stride);
  else if (event.key === 'ArrowRight') panel.panX = clampPan((panel.panX || 0) + stride);
  else if (event.key === 'ArrowUp') panel.panY = clampPan((panel.panY || 0) - stride);
  else if (event.key === 'ArrowDown') panel.panY = clampPan((panel.panY || 0) + stride);
  else return;
  event.preventDefault();
  redraw();
});

// -------------------------------------------------------------- controls

function chipRow(container, items, currentId, onChoose) {
  container.innerHTML = '';
  for (const item of items) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = item.label ?? item.caption;
    if (item.id === currentId) chip.classList.add('on');
    chip.addEventListener('click', () => onChoose(item.id));
    container.appendChild(chip);
  }
}

function refreshChipRows() {
  chipRow(el('layout-row'), LAYOUT_DEFS, model.layout, (id) => {
    model.layout = id;
    refreshChipRows();
    redraw();
  });
  chipRow(el('size-row'), EXPORT_SIZES, model.sizeId, (id) => {
    model.sizeId = id;
    refreshChipRows();
    redraw();
  });
}

function wirePanel() {
  const gradeSelect = el('in-grade');
  for (const grade of GRADE_DEFS) {
    const option = document.createElement('option');
    option.value = grade.id;
    option.textContent = grade.label;
    gradeSelect.appendChild(option);
  }
  gradeSelect.addEventListener('change', () => {
    const panel = activePanel();
    if (panel) { panel.grade = gradeSelect.value; redraw(); }
  });
  el('btn-grade-all').addEventListener('click', () => {
    for (const panel of model.panels) panel.grade = gradeSelect.value;
    redraw();
    announce('Grade applied to every panel.');
  });
  el('in-zoom').addEventListener('input', () => {
    const panel = activePanel();
    if (panel) { panel.zoom = parseFloat(el('in-zoom').value); redraw(); }
  });
  el('btn-reframe').addEventListener('click', () => {
    const panel = activePanel();
    if (panel) { panel.panX = 0; panel.panY = 0; panel.zoom = 1; redraw(); }
  });
  el('in-title').addEventListener('input', () => { model.title = el('in-title').value; redraw(); });
  el('in-tagline').addEventListener('input', () => { model.tagline = el('in-tagline').value; redraw(); });
  el('in-caption').addEventListener('input', () => { model.caption = el('in-caption').value; redraw(); });
  el('opt-palm').addEventListener('change', () => { model.dressing.palm = el('opt-palm').checked; redraw(); });
  el('opt-burst').addEventListener('change', () => { model.dressing.burst = el('opt-burst').checked; redraw(); });
  el('opt-sun').addEventListener('change', () => { model.dressing.sun = el('opt-sun').checked; redraw(); });
  el('opt-grain').addEventListener('change', () => { model.grain = el('opt-grain').checked; redraw(); });
  el('picker').addEventListener('change', () => {
    acceptFiles([...el('picker').files]);
    el('picker').value = '';
  });
  const stage = el('stage');
  stage.addEventListener('dragover', (event) => event.preventDefault());
  stage.addEventListener('drop', (event) => {
    event.preventDefault();
    acceptFiles([...event.dataTransfer.files]);
  });
  el('btn-export').addEventListener('click', () => downloadPNG(sizeById(model.sizeId)));
  el('btn-export-all').addEventListener('click', () => {
    EXPORT_SIZES.forEach((size, i) => setTimeout(() => downloadPNG(size), i * 350));
  });
}

function downloadPNG(size) {
  const offscreen = document.createElement('canvas');
  offscreen.width = size.w;
  offscreen.height = size.h;
  paintCover(offscreen.getContext('2d'), model, size.w, size.h, loadedPhotos, { forExport: true });
  offscreen.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vice-frame-5-${size.w}x${size.h}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    announce(`Exported ${size.w} × ${size.h} PNG.`);
  }, 'image/png');
}

// --------------------------------------------------------- screenshot mode
// ?shot=cover  -> cover alone, edge to edge (editor hidden by CSS class).
// ?shot=editor -> the normal editor. Both accept photo / caption / title /
// layout / size query params so a screenshot scene is fully described by
// its URL. photo fills every panel with that one stock photo.
function readShotQuery() {
  const query = new URLSearchParams(location.search);
  const mode = query.get('shot');
  if (!mode) return false;
  if (mode === 'cover') document.body.classList.add('only-cover');

  const photoId = query.get('photo');
  if (photoId && STOCK_PHOTOS.some((s) => s.id === photoId)) {
    growPanels();
    for (const panel of model.panels) panel.photo = photoId;
  }
  const caption = query.get('caption');
  if (caption) {
    model.caption = caption.toUpperCase();
    el('in-caption').value = model.caption;
  }
  const title = query.get('title');
  if (title) {
    model.title = title.toUpperCase();
    el('in-title').value = model.title;
  }
  const layoutId = query.get('layout');
  if (layoutId && LAYOUT_DEFS.some((d) => d.id === layoutId)) {
    model.layout = layoutId;
    growPanels();
    if (photoId && STOCK_PHOTOS.some((s) => s.id === photoId)) {
      for (const panel of model.panels) panel.photo = photoId;
    }
  }
  const sizeId = query.get('size');
  if (sizeId && EXPORT_SIZES.some((s) => s.id === sizeId)) model.sizeId = sizeId;
  return true;
}

// ------------------------------------------------------------------- boot

async function start() {
  wirePanel();
  const isShotScene = readShotQuery();
  refreshChipRows();
  await Promise.all([
    document.fonts.load('80px Anton'),
    document.fonts.load('30px "Archivo Black"'),
    ...STOCK_PHOTOS.map((s) => fetchPhoto(s.id, `samples/${s.id}.jpg`, s.label)),
  ]);
  await document.fonts.ready;
  redraw();
  if (isShotScene) {
    // Signal only after fonts and photos are in and a frame has painted.
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  }
}

start();
