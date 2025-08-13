// js/npc.js

// --- NPC definitions -------------------------------------------------------
export const npcs = [
  {
    id: 'homeless',
    x: 260, y: 180,
    w: 32, h: 40,                // fits the homeless sheet frame
    sprite: 'assets/npc_homeless.png',
    facing: 'front',             // 'front' | 'back' | 'side'
  },
{
  id: 'scout',
  x: 480, y: 120,
  w: 32, h: 50,                     // on-screen size (can match frameH to avoid scaling)
  sprite: 'assets/npc_scout.png',
  frame: { w: 32, h: 50, index: 0 },// <-- we'll tune these
}

];

const els = new Map(); // id -> HTMLElement

// --- helpers ---------------------------------------------------------------
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// Remove background by sampling a few corners (good for solid purple/black bg)
function chromaKeyCanvas(canvas, tolerance = 10) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;

  const sampleAt = (x, y) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i+1], data[i+2]];
  };
  const samples = [
    sampleAt(0, 0),
    sampleAt(width - 1, 0),
    sampleAt(0, height - 1),
  ];
  const tol2 = tolerance * tolerance;

  const isBg = (r, g, b) =>
    samples.some(([sr, sg, sb]) => {
      const dr = r - sr, dg = g - sg, db = b - sb;
      return dr*dr + dg*dg + db*db <= tol2;
    });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (isBg(r, g, b)) data[i+3] = 0;
  }
  ctx.putImageData(img, 0, 0);
}

// Slice a specific column from a horizontal strip (e.g., 3-pose homeless)
async function sliceColumnToURL(src, colIndex, cols, outW, outH, keyTolerance = 10) {
  const img = await loadImage(src);
  const frameW = Math.floor(img.width / cols);
  const frameH = img.height;

  const off = document.createElement('canvas');
  off.width = outW; off.height = outH;
  const ctx = off.getContext('2d');

  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, colIndex * frameW, 0, frameW, frameH, 0, 0, outW, outH);
  chromaKeyCanvas(off, keyTolerance);
  return off.toDataURL();
}

// Slice a cell from a grid sheet (for scout if you have a grid)
async function sliceGridToURL(src, cols, rows, col, row, outW, outH, keyTolerance = 10) {
  const img = await loadImage(src);
  const frameW = Math.floor(img.width / cols);
  const frameH = Math.floor(img.height / rows);

  const sx = col * frameW;
  const sy = row * frameH;

  const off = document.createElement('canvas');
  off.width = outW; off.height = outH;
  const ctx = off.getContext('2d');

  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, frameW, frameH, 0, 0, outW, outH);
  chromaKeyCanvas(off, keyTolerance);
  return off.toDataURL();
}

async function sliceByFrameSizeToURL(src, frameW, frameH, frameIndex, outW, outH, keyTolerance = 8) {
  const img = await loadImage(src);
  const cols = Math.floor(img.width / frameW);
  const sx = (frameIndex % cols) * frameW;
  const sy = Math.floor(frameIndex / cols) * frameH;

  const off = document.createElement('canvas');
  off.width = outW; off.height = outH;
  const ctx = off.getContext('2d');
  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, frameW, frameH, 0, 0, outW, outH);
  chromaKeyCanvas(off, keyTolerance);
  return off.toDataURL();
}


// Decide how to build one display frame for an NPC
async function buildNpcFrameURL(npc) {
  if (npc.id === 'homeless') {
    // homeless.png is a 3-column strip: [front, back, side]
    const col = npc.facing === 'back' ? 1 : npc.facing === 'side' ? 2 : 0;
    return sliceColumnToURL(npc.sprite, col, 3, npc.w, npc.h, 40); // higher tol for purple
  }
  if (npc.sheet) {
    const { cols, rows, col, row } = npc.sheet;
    return sliceGridToURL(npc.sprite, cols, rows, col, row, npc.w, npc.h, 8);
  }
  if (npc.frame) {
  const { w: fw, h: fh, index } = npc.frame;
  return sliceByFrameSizeToURL(npc.sprite, fw, fh, index, npc.w, npc.h, 12);
}

  // Single image fallback (still try to remove bg)
  const img = await loadImage(npc.sprite);
  const off = document.createElement('canvas');
  off.width = npc.w; off.height = npc.h;
  const ctx = off.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, npc.w, npc.h);
  chromaKeyCanvas(off, 8);
  return off.toDataURL();
}

// --- mount & proximity -----------------------------------------------------
  export function mountNPCs(gameEl, predicate = () => true) {
  const out = [];
  for (const npc of npcs.filter(predicate)) {

    const el = document.createElement('div');
    el.className = 'npc';
    el.style.cssText = `
      position:absolute; left:${npc.x}px; top:${npc.y}px;
      width:${npc.w}px; height:${npc.h}px;
      image-rendering: pixelated;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,0.35));
      background-repeat: no-repeat;
      background-position: 0 0;
      background-size: ${npc.w}px ${npc.h}px;
    `;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', npc.id);

    // temporary while slice runs
    el.style.backgroundImage = `url('${npc.sprite}')`;

    // slice/cutout and swap in
    buildNpcFrameURL(npc).then((url) => {
      el.style.backgroundImage = `url('${url}')`;
    }).catch(err => console.error('NPC sprite load failed:', npc.id, err));

    // idle breathing
    el.classList.add('idle');
    el.style.animationDelay = `${(out.length * 0.37) % 1.3}s`;

    els.set(npc.id, el);
    gameEl.appendChild(el);
    out.push(el);
  }
  return out;
}

// --- add these helpers near the top (under `const els = new Map()` is fine) ---
const rect = el => el.getBoundingClientRect();
const center = r => ({ x: (r.left + r.right)/2, y: (r.top + r.bottom)/2 });

// Edge-to-edge gap between two rects (0 means touching/overlapping)
function edgeGap(a, b) {
  const dx = Math.max(0, Math.max(b.left - a.right, a.left - b.right));
  const dy = Math.max(0, Math.max(b.top - a.bottom, a.top - b.bottom));
  return { dx, dy, max: Math.max(dx, dy) };
}

// --- replace your existing findNearbyNPC with this ---
export function findNearbyNPC(playerEl, margin = 16) {
  const pr = rect(playerEl);
  const pc = center(pr);

  let best = null;
  let bestScore = Infinity;

  for (const npc of npcs) {
  const el = els.get(npc.id);
  if (!el || !el.isConnected) continue;

    const nr = rect(el);
    const g = edgeGap(pr, nr);

    // talk if rectangles touch or are within `margin` pixels in any direction
    if (g.max <= margin) {
      // prefer the closest by center distance if multiple are near
      const nc = center(nr);
      const score = Math.hypot(pc.x - nc.x, pc.y - nc.y);
      if (score < bestScore) {
        best = npc;
        bestScore = score;
      }
    }
  }
  return best;
}


// --- dialogue selection / simple quest ------------------------------------
export function getDialogueFor(npc, game) {
  const { coins, flags } = game;

  if (npc.id === 'homeless') {
    if (!flags.homelessQuestDone) {
      if (coins >= 5) {
        return {
          lines: [
            "Homeless Man: 1... 2... 3... 4...",
            "It seems you are missing 1 coin",
            "Ah you're right, it slipped through my fingers...",
            "Over to the east I'll open the gate for you to continue on your journey.",
            "Don't let me catch you passed out in the woods again!"
          ],
          action: 'OPEN_EAST_GATE'
        };
      }
      return {
        lines: [
          "Homeless Man: Ah, you've awoken.",
          "I found you passed out in the woods over there and brought you to my home to rest.",
          "My kindness does not come cheap. Bring me 5 coins!"
        ]
      };
    }
    return {
      lines: [
        "Homeless Man: The gate is open now.",
        "Keep your wits about you, traveler."
      ]
    };
  }

if (npc.id === 'scout') {
  if (game.area === 2) {
    // --- Second area dialogue ---
    return {
      lines: [
        "Scout: Welcome to the eastern woods.",
        "You'll find rare items out here... but be ever wary of the danger that lurks.",
        "Press 'E' to pick up items when you are close by.",
        "Press 'I' to look at you items in your inventory.",
        "Safe travels, adventurer!"
      ]
    };
  } else {
    // --- First area dialogue ---
    return {
      lines: game.flags.homelessQuestDone
        ? [
            "Scout: Opened the gate already? Not bad.",
            "Be wary, traveler. Many dangers lurk past these walls."
          ]
        : [
            "Scout: If you’re short on coin, check near the tree lines.",
            "Birds love shiny things."
          ]
    };
  }
}


  return { lines: ["..."] };
}


export async function updateScoutFrame({ w, h, index } = {}) {
  const scout = npcs.find(n => n.id === 'scout');
  if (!scout) return;
  if (w) scout.frame.w = w;
  if (h) scout.frame.h = h;
  if (typeof index === 'number') scout.frame.index = index;

  const el = els.get('scout');
  if (!el) return;

  const url = await buildNpcFrameURL(scout);
  el.style.backgroundImage = `url('${url}')`;
}
