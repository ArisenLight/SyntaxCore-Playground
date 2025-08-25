// js/sprites.js
export const DIR = { DOWN:0, LEFT:1, RIGHT:2, UP:3 };

// Frame size per frame in your art
export const FRAME_W = 32;
export const FRAME_H = 50;

// Shared sprite store
export const ASSETS = {
  walk: { [DIR.DOWN]: [], [DIR.LEFT]: [], [DIR.RIGHT]: [], [DIR.UP]: [] },
  idle: { [DIR.DOWN]: null, [DIR.LEFT]: null, [DIR.RIGHT]: null, [DIR.UP]: null },
};

// File mappings (adjust paths as needed)
const WALK_SHEETS = {
  [DIR.RIGHT]: 'assets/walk_01.png',
  [DIR.DOWN]:  'assets/walk_02.png',
  [DIR.LEFT]:  'assets/walk_03.png',
  [DIR.UP]:    'assets/walk_00.png',
};

const IDLE_FRONT = 'assets/idle_01.png';
const IDLE_BACK  = 'assets/idle_00.png';
const IDLE_SIDE  = 'assets/idle_00.png'; // we’ll slice the other half + flip for LEFT

// ---- image helpers ----
const loadImage = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

// Slice a horizontal strip into frames FRAME_W × FRAME_H
async function sliceStrip(src) {
  const sheet = await loadImage(src);
  const cols = Math.max(1, Math.floor(sheet.width / FRAME_W));
  const off = document.createElement('canvas');
  off.width = FRAME_W; off.height = FRAME_H;
  const ctx = off.getContext('2d');

  const frames = [];
  for (let c = 0; c < cols; c++) {
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    ctx.drawImage(sheet, c*FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
    const frame = new Image();
    frame.src = off.toDataURL();
    // decode is fast and avoids flicker on first draw
    // eslint-disable-next-line no-await-in-loop
    await frame.decode();
    frames.push(frame);
  }
  return frames;
}

// Slice half of a 2-pose idle image (left/right halves)
async function sliceIdleHalf(src, which = 'left') {
  const img = await loadImage(src);
  const halfW = Math.floor(img.width / 2);
  const h = img.height;

  const off = document.createElement('canvas');
  off.width = FRAME_W;
  off.height = FRAME_H; // if your source is taller, it will scale into FRAME_H
  const ctx = off.getContext('2d');

  const sx = which === 'left' ? 0 : halfW;
  ctx.clearRect(0, 0, FRAME_W, FRAME_H);
  ctx.drawImage(img, sx, 0, halfW, h, 0, 0, FRAME_W, FRAME_H);

  const out = new Image();
  out.src = off.toDataURL();
  await out.decode();
  return out;
}

// Public: load all sprites, set player size, and set an initial idle frame
export async function loadSprites({ playerEl, spriteImg }) {
  // Load walk strips for each direction
  for (const dir of [DIR.DOWN, DIR.LEFT, DIR.RIGHT, DIR.UP]) {
    // eslint-disable-next-line no-await-in-loop
    ASSETS.walk[dir] = await sliceStrip(WALK_SHEETS[dir]);
  }

  // Idle poses (swapped to match your last working setup)
  ASSETS.idle[DIR.DOWN]  = await sliceIdleHalf(IDLE_FRONT, 'left');
  ASSETS.idle[DIR.UP]    = await sliceIdleHalf(IDLE_BACK,  'left');
  ASSETS.idle[DIR.RIGHT] = await sliceIdleHalf(IDLE_SIDE,  'right');
  ASSETS.idle[DIR.LEFT]  = ASSETS.idle[DIR.RIGHT]; // LEFT uses flip

  // Size the player box to one frame
  playerEl.style.width  = FRAME_W + 'px';
  playerEl.style.height = FRAME_H + 'px';

  // Initial sprite
  spriteImg.src = ASSETS.idle[DIR.DOWN].src;
}
