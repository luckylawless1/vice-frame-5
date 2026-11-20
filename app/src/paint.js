// VICE FRAME 5 — cover painter.
//
// Turns the editor's model (words, layout, per-panel photos + grades,
// dressing toggles) into pixels on a 2D canvas. Used identically for the
// live preview and for PNG exports, so what you see is what you download.

import { measureMasthead, headerTail, panelArea, shapesForLayout } from './geometry.js';

export const GRADE_DEFS = [
  { id: 'clean', label: 'Clean' },
  { id: 'vice-sunset', label: 'Vice Sunset' },
  { id: 'neon-night', label: 'Neon Night' },
  { id: 'ink-poster', label: 'Ink Poster' },
  { id: 'duotone-heat', label: 'Duotone Heat' },
  { id: 'split-tone', label: 'Split Tone' },
  { id: 'golden-hour', label: 'Golden Hour' },
];

const HEAD_FONT = 'Anton';
const SMALL_FONT = '"Archivo Black"';

// ------------------------------------------------------------------ grades
// Most grades are a CSS filter string plus a tinted overlay. Two of them
// (duotone-heat, ink-poster) need real pixel work and run afterwards on
// the panel's ImageData.

const FILTER_BY_GRADE = {
  clean: '',
  'vice-sunset': 'saturate(1.42) contrast(1.07) sepia(0.26) hue-rotate(-9deg) brightness(1.04)',
  'neon-night': 'saturate(1.58) contrast(1.19) brightness(0.93) hue-rotate(7deg)',
  'ink-poster': 'saturate(1.1) contrast(1.15)',
  'duotone-heat': 'grayscale(1) contrast(1.1) brightness(1.03)',
  'split-tone': 'saturate(1.24) contrast(1.09)',
  'golden-hour': 'sepia(0.3) saturate(1.32) brightness(1.07) contrast(1.03)',
};

function washOverlay(pen, gradeId, w, h) {
  let grad = null;
  if (gradeId === 'vice-sunset') {
    grad = pen.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,94,98,0.20)');
    grad.addColorStop(0.55, 'rgba(255,150,60,0.05)');
    grad.addColorStop(1, 'rgba(64,0,128,0.24)');
  } else if (gradeId === 'neon-night') {
    grad = pen.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,255,209,0.12)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(255,0,128,0.14)');
  } else if (gradeId === 'golden-hour') {
    grad = pen.createRadialGradient(w * 0.5, h * 0.32, h * 0.1, w * 0.5, h * 0.5, h * 1.05);
    grad.addColorStop(0, 'rgba(255,190,90,0.20)');
    grad.addColorStop(1, 'rgba(120,50,0,0.16)');
  } else if (gradeId === 'split-tone') {
    grad = pen.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,166,66,0.15)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,128,160,0.20)');
  }
  if (grad) {
    pen.fillStyle = grad;
    pen.fillRect(0, 0, w, h);
  }
}

// Map each pixel's brightness (the red channel holds the grayscale value
// after the filter pass) through a teal -> pink -> cream ramp.
function remapDuotone(pen, w, h) {
  const frame = pen.getImageData(0, 0, w, h);
  const px = frame.data;
  const low = [12, 44, 60];
  const mid = [231, 70, 138];
  const top = [255, 233, 244];
  for (let i = 0; i < px.length; i += 4) {
    const t = px[i] / 255;
    const a = t < 0.5 ? low : mid;
    const b = t < 0.5 ? mid : top;
    const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    px[i] = a[0] + (b[0] - a[0]) * k;
    px[i + 1] = a[1] + (b[1] - a[1]) * k;
    px[i + 2] = a[2] + (b[2] - a[2]) * k;
  }
  pen.putImageData(frame, 0, 0);
}

// Print-shop treatment: quantise colours, darken Sobel edges like inked
// linework, then lay halftone dots whose size follows the shadows.
function remapInk(pen, w, h) {
  const frame = pen.getImageData(0, 0, w, h);
  const px = frame.data;
  const luma = new Float32Array(w * h);
  for (let p = 0, i = 0; i < px.length; i += 4, p++) {
    luma[p] = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    for (let c = 0; c < 3; c++) {
      let v = px[i + c] / 255;
      v = Math.min(1, Math.max(0, (v - 0.5) * 1.15 + 0.5));
      px[i + c] = (Math.round(v * 4) / 4) * 255;
    }
  }
  pen.putImageData(frame, 0, 0);

  const inkLayer = pen.createImageData(w, h);
  const ink = inkLayer.data;
  for (let yy = 1; yy < h - 1; yy++) {
    for (let xx = 1; xx < w - 1; xx++) {
      const p = yy * w + xx;
      const gx = -luma[p - w - 1] - 2 * luma[p - 1] - luma[p + w - 1]
        + luma[p - w + 1] + 2 * luma[p + 1] + luma[p + w + 1];
      const gy = -luma[p - w - 1] - 2 * luma[p - w] - luma[p - w + 1]
        + luma[p + w - 1] + 2 * luma[p + w] + luma[p + w + 1];
      const strength = Math.sqrt(gx * gx + gy * gy);
      const alpha = Math.min(0.6, Math.max(0, (strength - 90) / 700) * 0.6);
      if (alpha > 0) {
        const o = p * 4;
        ink[o] = 14; ink[o + 1] = 7; ink[o + 2] = 20; ink[o + 3] = alpha * 255;
      }
    }
  }
  const scratch = document.createElement('canvas');
  scratch.width = w; scratch.height = h;
  scratch.getContext('2d').putImageData(inkLayer, 0, 0);
  pen.drawImage(scratch, 0, 0);

  pen.save();
  pen.globalCompositeOperation = 'multiply';
  pen.fillStyle = 'rgba(24,10,36,0.55)';
  const pitch = Math.max(5, Math.round(w / 130));
  for (let yy = pitch / 2; yy < h; yy += pitch) {
    for (let xx = pitch / 2; xx < w; xx += pitch) {
      const shade = luma[Math.floor(yy) * w + Math.floor(xx)] / 255;
      const radius = (1 - shade) * pitch * 0.42;
      if (radius > 0.5) {
        pen.beginPath();
        pen.arc(xx, yy, radius, 0, Math.PI * 2);
        pen.fill();
      }
    }
  }
  pen.restore();
}

// Paint one panel's photo into its own small canvas: cover-fit, then the
// panel's pan/zoom (clamped so the photo always covers the panel), then
// the panel's grade.
export function paintPanel(panel, boxW, boxH, image) {
  const surface = document.createElement('canvas');
  surface.width = Math.max(2, Math.round(boxW));
  surface.height = Math.max(2, Math.round(boxH));
  const pen = surface.getContext('2d');
  pen.fillStyle = '#101018';
  pen.fillRect(0, 0, surface.width, surface.height);
  if (!image) return surface;

  const scale = Math.max(surface.width / image.naturalWidth, surface.height / image.naturalHeight) * (panel.zoom || 1);
  const drawnW = image.naturalWidth * scale;
  const drawnH = image.naturalHeight * scale;
  let offX = (surface.width - drawnW) / 2 + (panel.panX || 0) * surface.width;
  let offY = (surface.height - drawnH) / 2 + (panel.panY || 0) * surface.height;
  offX = drawnW > surface.width ? Math.min(0, Math.max(surface.width - drawnW, offX)) : (surface.width - drawnW) / 2;
  offY = drawnH > surface.height ? Math.min(0, Math.max(surface.height - drawnH, offY)) : (surface.height - drawnH) / 2;

  const filterText = FILTER_BY_GRADE[panel.grade] ?? '';
  if (filterText) pen.filter = filterText;
  pen.drawImage(image, offX, offY, drawnW, drawnH);
  pen.filter = 'none';

  if (panel.grade === 'duotone-heat') remapDuotone(pen, surface.width, surface.height);
  if (panel.grade === 'ink-poster') remapInk(pen, surface.width, surface.height);
  washOverlay(pen, panel.grade, surface.width, surface.height);
  return surface;
}

// --------------------------------------------------------------- dressing

function traceStar(pen, cx, cy, r) {
  pen.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.46;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) pen.moveTo(px, py); else pen.lineTo(px, py);
  }
  pen.closePath();
}

function paintStars(pen, mast, W) {
  const count = 5;
  const step = mast.starRadius * 2.7;
  let cx = W / 2 - (step * (count - 1)) / 2;
  for (let i = 0; i < count; i++) {
    traceStar(pen, cx, mast.starCentreY, mast.starRadius);
    pen.fillStyle = '#ffd23e';
    pen.fill();
    pen.lineWidth = Math.max(1.5, mast.starRadius * 0.14);
    pen.strokeStyle = 'rgba(20,10,0,0.85)';
    pen.stroke();
    cx += step;
  }
}

function paintTagline(pen, model, mast, W, H) {
  const text = (model.tagline || '').trim();
  if (!text) return;
  const tail = headerTail(mast, model.tagline, H);
  pen.save();
  pen.font = `${Math.round(H * 0.03)}px ${SMALL_FONT}, sans-serif`;
  pen.textAlign = 'center';
  pen.textBaseline = 'alphabetic';
  // A slight shear leans the line like hand lettering; two passes give the
  // neon tube glow under a bright core.
  pen.transform(1, 0, -0.12, 1, 0, 0);
  const drawAt = W / 2 + H * 0.006;
  pen.shadowColor = '#ff2e88';
  pen.shadowBlur = H * 0.02;
  pen.fillStyle = '#ff7ac0';
  pen.fillText(text.toUpperCase(), drawAt, tail.tagBaseline);
  pen.shadowBlur = H * 0.008;
  pen.fillStyle = '#ffd7ec';
  pen.fillText(text.toUpperCase(), drawAt, tail.tagBaseline);
  pen.restore();
}

function paintBurst(pen, W, H) {
  // Edge rule: centre + radius always keep a clear margin from every edge,
  // so the badge is never clipped however small the canvas gets.
  const margin = Math.max(28, W * 0.024);
  const radius = W * 0.058;
  const cx = W - margin - radius;
  const cy = margin + radius;
  pen.save();
  pen.translate(cx, cy);
  pen.rotate(-0.21);
  pen.beginPath();
  const spikes = 16;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? radius : radius * 0.78;
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const px = Math.cos(angle) * rad;
    const py = Math.sin(angle) * rad;
    if (i === 0) pen.moveTo(px, py); else pen.lineTo(px, py);
  }
  pen.closePath();
  pen.fillStyle = '#ffd23e';
  pen.fill();
  pen.lineWidth = Math.max(2, W * 0.003);
  pen.strokeStyle = '#14100a';
  pen.stroke();
  let size = Math.round(radius * 0.58);
  pen.font = `${size}px ${SMALL_FONT}, sans-serif`;
  while (pen.measureText('NEW!').width > radius * 1.28 && size > 8) {
    size -= 2;
    pen.font = `${size}px ${SMALL_FONT}, sans-serif`;
  }
  pen.fillStyle = '#14100a';
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  pen.fillText('NEW!', 0, radius * 0.03);
  pen.restore();
}

function paintPalm(pen, baseX, baseY, size) {
  pen.save();
  pen.translate(baseX, baseY);
  pen.strokeStyle = 'rgba(10,60,58,0.9)';
  pen.lineWidth = size * 0.09;
  pen.lineCap = 'round';
  pen.shadowColor = 'rgba(46,230,200,0.55)';
  pen.shadowBlur = size * 0.12;
  pen.beginPath();
  pen.moveTo(0, 0);
  pen.quadraticCurveTo(size * 0.12, -size * 0.5, size * 0.3, -size * 0.92);
  pen.stroke();
  const topX = size * 0.3;
  const topY = -size * 0.92;
  for (const angle of [-2.9, -2.2, -1.5, -0.8, -0.15]) {
    pen.beginPath();
    pen.moveTo(topX, topY);
    pen.quadraticCurveTo(
      topX + Math.cos(angle) * size * 0.42, topY + Math.sin(angle) * size * 0.3 - size * 0.1,
      topX + Math.cos(angle) * size * 0.72, topY + Math.sin(angle) * size * 0.52 + size * 0.16,
    );
    pen.stroke();
  }
  pen.restore();
}

function paintSun(pen, cx, cy, r) {
  pen.save();
  pen.strokeStyle = 'rgba(255,170,40,0.9)';
  pen.fillStyle = 'rgba(255,196,64,0.9)';
  pen.lineWidth = r * 0.14;
  pen.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    pen.beginPath();
    pen.moveTo(cx + Math.cos(angle) * r * 1.25, cy + Math.sin(angle) * r * 1.25);
    pen.lineTo(cx + Math.cos(angle) * r * 1.6, cy + Math.sin(angle) * r * 1.6);
    pen.stroke();
  }
  pen.beginPath();
  pen.arc(cx, cy, r, 0, Math.PI * 2);
  pen.fill();
  pen.restore();
}

// Small deterministic generator (xorshift32): the barcode and the grain
// must come out identical on every render, preview and export alike.
function xorshift(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

function paintBarcode(pen, W, H, captionTop) {
  const blockW = W * 0.104;
  const blockH = H * 0.05;
  const blockX = Math.max(28, W * 0.024);
  const blockY = captionTop - blockH - H * 0.012;
  pen.save();
  pen.fillStyle = '#f7f3e9';
  pen.fillRect(blockX, blockY, blockW, blockH);
  pen.strokeStyle = 'rgba(0,0,0,0.6)';
  pen.lineWidth = 1.5;
  pen.strokeRect(blockX, blockY, blockW, blockH);
  const next = xorshift(987654321);
  const barTop = blockY + blockH * 0.1;
  const barHeight = blockH * 0.62;
  let cursor = blockX + blockW * 0.06;
  const limit = blockX + blockW * 0.94;
  pen.fillStyle = '#111111';
  while (cursor < limit) {
    const barW = (0.6 + next() * 2.6) * (blockW / 90);
    if (next() > 0.32) pen.fillRect(cursor, barTop, barW, barHeight);
    cursor += barW + (0.6 + next() * 1.8) * (blockW / 90);
  }
  pen.font = `${Math.round(blockH * 0.2)}px ${SMALL_FONT}, sans-serif`;
  pen.textAlign = 'center';
  pen.fillText('0 60906 20260 6', blockX + blockW / 2, blockY + blockH * 0.94);
  pen.restore();
}

let sharedGrainTile = null;
function paintGrain(pen, W, H) {
  if (!sharedGrainTile) {
    sharedGrainTile = document.createElement('canvas');
    sharedGrainTile.width = 140;
    sharedGrainTile.height = 140;
    const tilePen = sharedGrainTile.getContext('2d');
    const data = tilePen.createImageData(140, 140);
    const next = xorshift(424242);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(next() * 255);
      data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
    }
    tilePen.putImageData(data, 0, 0);
  }
  pen.save();
  pen.globalAlpha = 0.05;
  pen.globalCompositeOperation = 'overlay';
  pen.fillStyle = pen.createPattern(sharedGrainTile, 'repeat');
  pen.fillRect(0, 0, W, H);
  pen.restore();
}

function roundedBarPath(pen, x, y, w, h, r) {
  pen.beginPath();
  pen.moveTo(x + r, y);
  pen.lineTo(x + w - r, y);
  pen.arcTo(x + w, y, x + w, y + r, r);
  pen.lineTo(x + w, y + h - r);
  pen.arcTo(x + w, y + h, x + w - r, y + h, r);
  pen.lineTo(x + r, y + h);
  pen.arcTo(x, y + h, x, y + h - r, r);
  pen.lineTo(x, y + r);
  pen.arcTo(x, y, x + r, y, r);
  pen.closePath();
}

// ------------------------------------------------------------- full cover

export function paintCover(pen, model, W, H, photoMap, options = {}) {
  // Night-city backdrop with a soft pink bloom near the top.
  const backdrop = pen.createLinearGradient(0, 0, 0, H);
  backdrop.addColorStop(0, '#1c0c2e');
  backdrop.addColorStop(0.5, '#0e0817');
  backdrop.addColorStop(1, '#05050a');
  pen.fillStyle = backdrop;
  pen.fillRect(0, 0, W, H);
  const bloom = pen.createRadialGradient(W / 2, H * 0.1, 10, W / 2, H * 0.1, W * 0.7);
  bloom.addColorStop(0, 'rgba(255,46,136,0.14)');
  bloom.addColorStop(1, 'rgba(255,46,136,0)');
  pen.fillStyle = bloom;
  pen.fillRect(0, 0, W, H);

  const mast = measureMasthead(pen, model.title, W, H);
  const area = panelArea(mast, model.tagline, W, H);
  const shapes = shapesForLayout(model.layout, area.x, area.y, area.w, area.h);

  shapes.forEach((shape, index) => {
    const panel = model.panels[index];
    if (!panel) return;
    const rendered = paintPanel(panel, shape.w, shape.h, photoMap.get(panel.photo));
    const traceShape = () => {
      pen.beginPath();
      if (shape.corners) {
        shape.corners.forEach(([px, py], k) => (k === 0 ? pen.moveTo(px, py) : pen.lineTo(px, py)));
        pen.closePath();
      } else {
        pen.rect(shape.x, shape.y, shape.w, shape.h);
      }
    };
    pen.save();
    traceShape();
    pen.clip();
    pen.drawImage(rendered, shape.x, shape.y);
    pen.restore();
    pen.save();
    traceShape();
    pen.lineWidth = Math.max(2, W * 0.0022);
    pen.strokeStyle = 'rgba(247,243,233,0.9)';
    pen.stroke();
    pen.restore();
    if (!options.forExport && index === model.selected) {
      pen.save();
      if (shape.corners) {
        traceShape();
      } else {
        pen.beginPath();
        pen.rect(shape.x - 3, shape.y - 3, shape.w + 6, shape.h + 6);
      }
      pen.lineWidth = 5;
      pen.strokeStyle = '#2ee6c8';
      pen.stroke();
      pen.restore();
    }
  });

  if (model.dressing.palm) paintPalm(pen, area.x + area.w * 0.035, area.y + area.h * 0.3, area.h * 0.3);
  if (model.dressing.sun) paintSun(pen, area.x + area.w * 0.055, area.y + area.h * 0.075, area.w * 0.02);

  const vignette = pen.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.26)');
  pen.fillStyle = vignette;
  pen.fillRect(0, 0, W, H);

  // Masthead: gradient-filled Anton with a dark keyline, line by line.
  pen.save();
  pen.font = `${mast.fontPx}px ${HEAD_FONT}, sans-serif`;
  pen.textAlign = 'center';
  pen.textBaseline = 'alphabetic';
  const titleGrad = pen.createLinearGradient(W * 0.15, 0, W * 0.85, 0);
  titleGrad.addColorStop(0, '#ff5da2');
  titleGrad.addColorStop(0.55, '#c86bff');
  titleGrad.addColorStop(1, '#2ee6c8');
  mast.wrapped.forEach((line, i) => {
    const baseline = mast.topEdge + mast.fontPx + i * mast.leading;
    pen.lineWidth = Math.max(3, mast.fontPx * 0.09);
    pen.strokeStyle = 'rgba(10,4,18,0.9)';
    pen.strokeText(line, W / 2, baseline);
    pen.fillStyle = titleGrad;
    pen.fillText(line, W / 2, baseline);
  });
  pen.restore();

  paintStars(pen, mast, W);
  paintTagline(pen, model, mast, W, H);

  // Caption bar with its gradient accent strip.
  const capTop = H * 0.878;
  const capHeight = H * 0.078;
  const capX = W * 0.035;
  const capW = W * 0.93;
  const captionText = (model.caption || '').trim();
  if (captionText) {
    pen.save();
    roundedBarPath(pen, capX, capTop, capW, capHeight, Math.min(14, capHeight * 0.18));
    pen.fillStyle = 'rgba(8,8,16,0.87)';
    pen.fill();
    const accent = pen.createLinearGradient(capX, 0, capX + capW, 0);
    accent.addColorStop(0, '#ff5da2');
    accent.addColorStop(1, '#2ee6c8');
    pen.fillStyle = accent;
    pen.fillRect(capX, capTop, capW, Math.max(3, H * 0.004));
    let capPx = Math.round(H * 0.036);
    pen.font = `${capPx}px ${SMALL_FONT}, sans-serif`;
    while (pen.measureText(captionText.toUpperCase()).width > capW * 0.92 && capPx > 12) {
      capPx -= 2;
      pen.font = `${capPx}px ${SMALL_FONT}, sans-serif`;
    }
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillStyle = '#f7f3e9';
    pen.fillText(captionText.toUpperCase(), W / 2, capTop + capHeight * 0.56);
    pen.restore();
  }

  paintBarcode(pen, W, H, capTop);

  pen.save();
  pen.font = `${Math.round(H * 0.017)}px ${HEAD_FONT}, sans-serif`;
  pen.textAlign = 'right';
  pen.textBaseline = 'alphabetic';
  pen.fillStyle = 'rgba(247,243,233,0.88)';
  pen.fillText('ISSUE 06 · LAS LUMEN · $6.99', W - Math.max(28, W * 0.024), capTop - H * 0.007);
  pen.restore();

  if (model.dressing.burst) paintBurst(pen, W, H);
  if (model.grain) paintGrain(pen, W, H);

  return { mast, area, shapes };
}
