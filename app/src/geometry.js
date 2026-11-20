// VICE FRAME 5 — cover geometry.
//
// Everything positional lives here: the three export sizes, the six panel
// layouts, and the masthead measurement that decides where the header ends.
// The one invariant the rest of the app leans on: the wanted-stars row and
// the tagline are positioned from the *measured* bottom edge of the wrapped
// title, so no title, however long, can ever collide with them.

export const EXPORT_SIZES = [
  { id: 'square', caption: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', caption: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', caption: '1920 × 1080', w: 1920, h: 1080 },
];

export const LAYOUT_DEFS = [
  { id: 'cover-star', label: 'Cover Star', count: 3 },
  { id: 'collage-four', label: 'Collage Four', count: 4 },
  { id: 'panel-grid', label: 'Panel Grid', count: 6 },
  { id: 'crew-wide', label: 'Crew Wide', count: 3 },
  { id: 'cover-closeup', label: 'Cover Closeup', count: 3 },
  { id: 'angled-grid', label: 'Angled Grid', count: 3 },
];

export function panelCountFor(layoutId) {
  const def = LAYOUT_DEFS.find((d) => d.id === layoutId);
  return def ? def.count : 1;
}

// Wrap and measure the masthead title for a canvas of W x H.
// `pen` is any 2D context; only its text metrics are used.
export function measureMasthead(pen, titleText, W, H) {
  const wording = (titleText || '').toUpperCase();
  let fontPx = Math.round(H * 0.112);
  const setFont = () => { pen.font = `${fontPx}px Anton, sans-serif`; };
  setFont();
  // No single word may be wider than the measure: shrink until it fits.
  let widestWord = 0;
  for (const word of wording.split(/\s+/)) {
    widestWord = Math.max(widestWord, pen.measureText(word).width);
  }
  while (widestWord > W * 0.9 && fontPx > 20) {
    fontPx -= 4;
    setFont();
    widestWord = 0;
    for (const word of wording.split(/\s+/)) {
      widestWord = Math.max(widestWord, pen.measureText(word).width);
    }
  }
  // Greedy word wrap into the centred measure.
  const measure = W * 0.92;
  const wrapped = [];
  let current = '';
  for (const word of wording.split(/\s+/).filter(Boolean)) {
    const attempt = current === '' ? word : `${current} ${word}`;
    if (pen.measureText(attempt).width <= measure || current === '') current = attempt;
    else { wrapped.push(current); current = word; }
  }
  if (current !== '') wrapped.push(current);
  if (wrapped.length === 0) wrapped.push('');

  const leading = fontPx * 1.04;
  const topEdge = H * 0.036;
  const bottomEdge = topEdge + wrapped.length * leading;
  const starRadius = Math.max(10, H * 0.02);
  const starCentreY = bottomEdge + H * 0.028 + starRadius;
  return {
    wrapped,
    fontPx,
    leading,
    topEdge,
    bottomEdge,
    starRadius,
    starCentreY,
    starsBottom: starCentreY + starRadius,
  };
}

// Where the tagline baseline sits, and where the header as a whole ends.
// Both derive from the stars row, which derives from the title — see the
// invariant at the top of this file.
export function headerTail(mast, taglineText, H) {
  const hasTag = Boolean((taglineText || '').trim());
  const tagBaseline = hasTag ? mast.starsBottom + H * 0.042 : mast.starsBottom;
  const endY = hasTag ? tagBaseline + H * 0.006 : mast.starsBottom;
  return { hasTag, tagBaseline, endY };
}

// The rectangle the panels live in: below the header, above the caption zone.
export function panelArea(mast, taglineText, W, H) {
  const tail = headerTail(mast, taglineText, H);
  const top = tail.endY + H * 0.024;
  const bottom = H * 0.855;
  const insetX = W * 0.038;
  return { x: insetX, y: top, w: W - insetX * 2, h: bottom - top };
}

// Panel shapes inside (x, y, w, h). Plain panels are {x, y, w, h}; the
// angled layout's panels also carry `corners`, a polygon used both as the
// clip path and for hit-testing, with x/y/w/h as its bounding box.
export function shapesForLayout(layoutId, x, y, w, h) {
  const gutter = Math.max(8, w * 0.014);
  switch (layoutId) {
    case 'cover-star': {
      const heroW = w * 0.615;
      const sideX = x + heroW + gutter;
      const sideW = w - heroW - gutter;
      const sideH = (h - gutter) / 2;
      return [
        { x, y, w: heroW, h },
        { x: sideX, y, w: sideW, h: sideH },
        { x: sideX, y: y + sideH + gutter, w: sideW, h: sideH },
      ];
    }
    case 'collage-four': {
      const cellW = (w - gutter) / 2;
      const cellH = (h - gutter) / 2;
      const cells = [];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          cells.push({ x: x + col * (cellW + gutter), y: y + row * (cellH + gutter), w: cellW, h: cellH });
        }
      }
      return cells;
    }
    case 'panel-grid': {
      const cellW = (w - 2 * gutter) / 3;
      const cellH = (h - gutter) / 2;
      const cells = [];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          cells.push({ x: x + col * (cellW + gutter), y: y + row * (cellH + gutter), w: cellW, h: cellH });
        }
      }
      return cells;
    }
    case 'crew-wide': {
      const topH = h * 0.6;
      const lowH = h - topH - gutter;
      const lowW = (w - gutter) / 2;
      return [
        { x, y, w, h: topH },
        { x, y: y + topH + gutter, w: lowW, h: lowH },
        { x: x + lowW + gutter, y: y + topH + gutter, w: lowW, h: lowH },
      ];
    }
    case 'cover-closeup': {
      const heroW = w * 0.755;
      const insetX2 = x + heroW + gutter;
      const insetW = w - heroW - gutter;
      const insetH = (h - gutter) / 2;
      return [
        { x, y, w: heroW, h },
        { x: insetX2, y, w: insetW, h: insetH },
        { x: insetX2, y: y + insetH + gutter, w: insetW, h: insetH },
      ];
    }
    case 'angled-grid': {
      const slant = w * 0.07;
      const asPoly = (points) => {
        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        const bx = Math.min(...xs);
        const by = Math.min(...ys);
        return { corners: points, x: bx, y: by, w: Math.max(...xs) - bx, h: Math.max(...ys) - by };
      };
      return [
        asPoly([[x, y], [x + w * 0.355, y], [x + w * 0.355 - slant, y + h], [x, y + h]]),
        asPoly([[x + w * 0.368, y], [x + w * 0.685, y], [x + w * 0.685 - slant, y + h], [x + w * 0.368 - slant, y + h]]),
        asPoly([[x + w * 0.698, y], [x + w, y], [x + w, y + h], [x + w * 0.698 - slant, y + h]]),
      ];
    }
    default:
      return [{ x, y, w, h }];
  }
}

// Hit test used by the editor for panel selection.
export function shapeContains(shape, px, py) {
  if (shape.corners) {
    let inside = false;
    const pts = shape.corners;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      const crosses = (yi > py) !== (yj > py);
      if (crosses && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  return px >= shape.x && px <= shape.x + shape.w && py >= shape.y && py <= shape.y + shape.h;
}
