// js/main.js
import { DIR, FRAME_W, FRAME_H, ASSETS, loadSprites } from './sprites.js';
import { initUI, isDialogueOpen, showDialogue, advanceDialogue } from './ui.js';
import { npcs, mountNPCs, findNearbyNPC, getDialogueFor } from './npc.js';
import { plantTreesAt, placeTentAt } from './props.js';


// --- Helpers ---
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rectsOverlap = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

function fadeTransition(doWork) {
  return new Promise(async (resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute; inset:0; background:#000; opacity:0;
      transition:opacity .25s; pointer-events:none; z-index:9999;
    `;
    gameEl.appendChild(overlay);
    requestAnimationFrame(() => (overlay.style.opacity = '1'));
    setTimeout(async () => {
      await doWork();                 // do the swap while screen is black
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); resolve(); }, 250);
    }, 250);
  });
}
function clearTents() {
  document.querySelectorAll('.tent-prop, .tent-hitbox').forEach(el => el.remove());
  state.obstacles = state.obstacles.filter(o => !o.classList.contains('tent-hitbox'));
}


// --- DOM ---
const gameEl = document.getElementById('game');
const playerEl = document.getElementById('player');
const spriteImg = document.getElementById('sprite');
const coinCountEl = document.getElementById('coinCount');
const speedEl = document.getElementById('speed');

// --- State ---
const state = {
  pos: { x: 100, y: 100 },
  vel: { x: 0, y: 0 },
  baseSpeed: 180,
  sprintMult: 1.7,
  keys: new Set(),
  coins: 0,
  obstacles: [],
  coinNodes: new Set(),
  dir: DIR.DOWN,
  frame: 0,
  frameTimer: 0,
  frameDelay: 0.15,
  lastTime: performance.now(),
  flags: { homelessQuestDone: false },
};

const talkHint = document.createElement('div');
talkHint.className = 'talk-hint';
talkHint.textContent = 'E';
talkHint.style.cssText = 'position:absolute; padding:2px 4px; font:12px/1 sans-serif; background:rgba(0,0,0,.6); color:#fff; border-radius:4px; transform:translate(-50%,-140%); pointer-events:none; display:none; z-index:9999;';
gameEl.appendChild(talkHint);



// Obstacles present in HTML
state.obstacles = Array.from(document.querySelectorAll('.obstacle'));
// Mount NPCs into the world and also treat them as obstacles
const npcEls = mountNPCs(gameEl);
state.obstacles.push(...npcEls);

// Decorate the east gate with hinges once
const eastGateEl = document.getElementById('eastGate');
if (eastGateEl && !eastGateEl.querySelector('.hinges')) {
  eastGateEl.appendChild(Object.assign(document.createElement('div'), { className: 'hinges' }));
}


plantTreesAt(gameEl, [

  { x: 15, y: 525},
  { x: 75, y: 525}, 
  { x: 135, y: 520},
  { x: 195, y: 530}, 
  { x: 255, y: 520},
  { x: 310, y: 510},
  { x: 350, y: 535},
  { x: 420, y: 520},
  { x: 500, y: 530},
  { x: 550, y: 510},
    { x: 10,  y: 465 },
  { x: 12,  y: 405 },
  { x: 10,  y: 345 },
  { x: 13,  y: 275 },
  { x: 11,  y: 225 },
  { x: 14,  y: 165 },
  { x: 12,  y: 105 },
  { x: 13,  y: 45 },
    { x: 65,  y: 20 },
  { x: 125, y: 15 },
  { x: 185, y: 20 },
  { x: 245, y: 15 },
  { x: 305, y: 20 },
  { x: 365, y: 15 },
  { x: 425, y: 20 },
  { x: 485, y: 15 },
  { x: 545, y: 20 }
]).then(colliders => {
  state.obstacles.push(...colliders);
  extendTrees();
});

// --- Helpers for extension ---
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function extendTrees() {
  const bounds = gameEl.getBoundingClientRect();
  const trees = Array.from(gameEl.querySelectorAll('.tree'));
  if (!trees.length) return;

  // Find actual top/bottom rows based on current trees
  const ys   = trees.map(t => t.offsetTop);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const ROW_TOL = 14;
  const topRow    = trees.filter(t => Math.abs(t.offsetTop - minY) <= ROW_TOL);
  const bottomRow = trees.filter(t => Math.abs(t.offsetTop - maxY) <= ROW_TOL);
  const avgY = arr => Math.round(arr.reduce((s,t) => s + t.offsetTop, 0) / arr.length);
  const yTop    = topRow.length    ? avgY(topRow)    : minY;
  const yBottom = bottomRow.length ? avgY(bottomRow) : maxY;

  // spacing similar to your pattern
  const STEP = 60;
  const JITTER_X = 8;
  const JITTER_Y_TOP = 4;
  const JITTER_Y_BOTTOM = 10;

  const xsTop    = topRow.map(t => t.offsetLeft).sort((a,b)=>a-b);
  const xsBottom = bottomRow.map(t => t.offsetLeft).sort((a,b)=>a-b);

  const newPos = [];

  // Extend TOP row both directions
  {
    let x = xsTop.length ? xsTop[xsTop.length - 1] + STEP : 15;
    while (x < bounds.width - 20) {
      newPos.push({ x: x + rand(-JITTER_X, JITTER_X), y: yTop + rand(-JITTER_Y_TOP, JITTER_Y_TOP) });
      x += STEP;
    }
    x = xsTop.length ? xsTop[0] - STEP : 15 - STEP;
    while (x > 0) {
      newPos.push({ x: x + rand(-JITTER_X, JITTER_X), y: yTop + rand(-JITTER_Y_TOP, JITTER_Y_TOP) });
      x -= STEP;
    }
  }

  // Extend BOTTOM row both directions
  {
    let x = xsBottom.length ? xsBottom[xsBottom.length - 1] + STEP : 15;
    while (x < bounds.width - 20) {
      newPos.push({ x: x + rand(-JITTER_X, JITTER_X), y: yBottom + rand(-JITTER_Y_BOTTOM, JITTER_Y_BOTTOM) });
      x += STEP;
    }
    x = xsBottom.length ? xsBottom[0] - STEP : 15 - STEP;
    while (x > 0) {
      newPos.push({ x: x + rand(-JITTER_X, JITTER_X), y: yBottom + rand(-JITTER_Y_BOTTOM, JITTER_Y_BOTTOM) });
      x -= STEP;
    }
  }

  // 3–4 random interior trees, avoiding NPCs and other trees
  {
    const treeW = trees[0].offsetWidth;
    const treeH = trees[0].offsetHeight;

    const overlaps = (a, b) =>
      !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

    const gr = gameEl.getBoundingClientRect();
    const npcRects = Array.from(gameEl.querySelectorAll('.npc')).map(el => {
      const r = el.getBoundingClientRect();
      return { left:r.left-gr.left, top:r.top-gr.top, right:r.right-gr.left, bottom:r.bottom-gr.top };
    });

    const existingXY = trees.map(t => ({ x: t.offsetLeft + treeW/2, y: t.offsetTop + treeH/2 }));
    const insideSoFar = [];
    const MIN_DIST = 72;
    const targetExtras = rand(3,4);
    let tries = 0;

    const farFromTrees = (px,py) => {
      const cx = px + treeW/2, cy = py + treeH/2;
      const far = arr => arr.every(q => Math.hypot(cx - q.x, cy - q.y) > MIN_DIST);
      return far(existingXY) && far(insideSoFar);
    };
    const notOnNPC = (px,py) => {
      const cand = { left:px, top:py, right:px+treeW, bottom:py+treeH };
      return npcRects.every(n => !overlaps(cand, n));
    };

    while (insideSoFar.length < targetExtras && tries < 120) {
      tries++;
      const px = rand(20, Math.max(20, Math.floor(bounds.width  - treeW - 20)));
      const py = rand(20, Math.max(20, Math.floor(bounds.height - treeH - 20)));
      if (farFromTrees(px,py) && notOnNPC(px,py)) {
        newPos.push({ x:px, y:py });
        insideSoFar.push({ x:px + treeW/2, y:py + treeH/2 });
      }
    }
  }

  // ✅ APPLY the new positions
  if (newPos.length) {
    const cols = await plantTreesAt(gameEl, newPos);
    state.obstacles.push(...cols);
  }
}

async function goToEastArea() {
  await fadeTransition(async () => {
    // 1) Clear dynamic world (trees, tent, coins, NPC elements)
    document.querySelectorAll('.tree, .tent, .coin, .npc').forEach(el => el.remove());
    state.coinNodes.clear();

    // 2) Reset obstacles to any remaining static ones (e.g., walls still in HTML)
    state.obstacles = Array.from(document.querySelectorAll('.obstacle'));

    // 3) (Optional) change backdrop via a CSS class
    //    Add CSS like: .area-east { background:#3a5f3a; } etc
    gameEl.classList.add('area-east');

    // 4) Build new border trees for the east area
    const bounds = gameEl.getBoundingClientRect();
    const STEP = 60;
    const makeRow = (y) => {
      const pts = [];
      for (let x = 15; x < bounds.width - 20; x += STEP) pts.push({ x, y });
      return pts;
    };

    const topRow = makeRow(20);
    const bottomRow = makeRow(Math.max(40, Math.floor(bounds.height - 60)));

    const c1 = await plantTreesAt(gameEl, topRow);
    const c2 = await plantTreesAt(gameEl, bottomRow);
    state.obstacles.push(...c1, ...c2);

    // (Optional) drop a tent/landmark in Area 2
    // const tCols = await placeTentAt(gameEl, [{ x: 220, y: 210 }], { tolerance: 14 });
    // state.obstacles.push(...tCols);

    // 5) Spawn a few interior trees (reusing your helper)
    // If you want the same “avoid NPCs” logic, call extendTrees() now.
    // extendTrees(); // <- optional here if you want extras in Area 2

    // 6) Put the player at the west edge in a safe Y
    state.pos.x = 8;
    state.pos.y = Math.min(Math.max(state.pos.y, 40), bounds.height - 60);
    playerEl.style.left = state.pos.x + 'px';
    playerEl.style.top  = state.pos.y + 'px';
  });
}



placeTentAt(gameEl, [
  { x: 150, y: 150 }   // bottom-left of tent will sit on (300,300)
], {
  tolerance: 14,       // bump up if you still see a faint border
  scale: 1
}).then(cols => {
  state.obstacles.push(...cols);
});

// --- Coins ---
function spawnCoins(n = 8) {
  const bounds = gameEl.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'coin';
    // try several positions avoiding obstacles
    for (let t = 0; t < 20; t++) {
      const x = Math.random() * (bounds.width - 18);
      const y = Math.random() * (bounds.height - 18);
      c.style.left = x + 'px';
      c.style.top = y + 'px';
      gameEl.appendChild(c);
      const ok = !state.obstacles.some(o => rectsOverlap(c.getBoundingClientRect(), o.getBoundingClientRect()));
      if (ok) break;
      c.remove();
    }
    gameEl.appendChild(c);
    state.coinNodes.add(c);
  }
}
spawnCoins(5);

function openEastGate() {
  const gate = document.getElementById('eastGate');
  if (!gate) return;

  // stop blocking immediately (optional): remove from obstacles first
  state.obstacles = state.obstacles.filter(el => el !== gate);

  // play open anim then remove
  gate.classList.add('opening');
  setTimeout(() => {
    gate.remove();
      clearTents();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = 'You hear a heavy bolt slide open to the east...';
    document.querySelector('.game-wrap')?.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }, 320);
}



// --- Input ---
const keyMap = {
  'ArrowUp': 'up',    'KeyW': 'up',
  'ArrowDown': 'down','KeyS': 'down',
  'ArrowLeft': 'left','KeyA': 'left',
  'ArrowRight': 'right','KeyD': 'right',
  'ShiftLeft': 'shift', 'ShiftRight': 'shift',
  'KeyE': 'interact',
};

window.addEventListener('keydown', (e) => {
  const code = e.code in keyMap ? e.code : e.key;
  if (keyMap[code]) {
    e.preventDefault();
    state.keys.add(keyMap[code]);
  }
});

window.addEventListener('keyup', (e) => {
  const code = e.code in keyMap ? e.code : e.key;
  const action = keyMap[code];
  if (!action) return;

  if (action === 'interact') {
    if (isDialogueOpen()) {
      advanceDialogue();
    } else {
      const npc = findNearbyNPC(playerEl, 10);
      if (npc) {
        const dlg = getDialogueFor(npc, { coins: state.coins, flags: state.flags });

// replace your "face the NPC" block with this
const pr = playerEl.getBoundingClientRect();
const npcEl = document.querySelector(`[aria-label="${npc.id}"]`);
const nr = npcEl?.getBoundingClientRect();
if (nr) {
  const dx = (nr.left + nr.width/2) - (pr.left + pr.width/2);
  const dy = (nr.top + nr.height/2) - (pr.top + pr.height/2);
  if (Math.abs(dx) > Math.abs(dy)) {
    state.dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
  } else {
    state.dir = dy > 0 ? DIR.DOWN : DIR.UP;
  }
}


        showDialogue(dlg.lines, () => {
          if (dlg.action === 'OPEN_EAST_GATE' && !state.flags.homelessQuestDone) {
            openEastGate();
            state.flags.homelessQuestDone = true;
          }
        });
      }
    }
  }
  state.keys.delete(action);
});




// --- Step ---
function step(dt) {
    // If dialogue is open, freeze movement (but idle breathing stays)
if (isDialogueOpen()) {
  // zero movement, keep facing from previous frame
  const img = ASSETS.idle[state.dir];
  playerEl.classList.add('idle');
  playerEl.classList.toggle('flip-x', state.dir === DIR.LEFT);
  if (img) spriteImg.src = img.src;
  return; // skip the rest of step()
}

  // build direction vector from held keys
  let dx = 0, dy = 0;
  if (state.keys.has('left'))  dx -= 1;
  if (state.keys.has('right')) dx += 1;
  if (state.keys.has('up'))    dy -= 1;
  if (state.keys.has('down'))  dy += 1;

  // update facing based on last input
  if (dx !== 0 || dy !== 0) {
    if (Math.abs(dx) > Math.abs(dy)) {
      state.dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      state.dir = dy > 0 ? DIR.DOWN : DIR.UP;
    }
  }

  // normalize diagonal & speed
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  const sprint = state.keys.has('shift') ? state.sprintMult : 1;
  const spd = state.baseSpeed * sprint;
  speedEl.textContent = Math.round(spd);

  // proposed new position
  let nx = state.pos.x + dx * spd * dt;
  let ny = state.pos.y + dy * spd * dt;

  const bounds = gameEl.getBoundingClientRect();
  const size = playerEl.getBoundingClientRect();

  // clamp to play area
  nx = clamp(nx, 0, bounds.width - size.width);
  ny = clamp(ny, 0, bounds.height - size.height);

  // axis-resolve collisions
  playerEl.style.left = nx + 'px';
  let collidedX = state.obstacles.some(o => rectsOverlap(playerEl.getBoundingClientRect(), o.getBoundingClientRect()));
  if (collidedX) playerEl.style.left = state.pos.x + 'px'; else state.pos.x = nx;

  playerEl.style.top = ny + 'px';
  let collidedY = state.obstacles.some(o => rectsOverlap(playerEl.getBoundingClientRect(), o.getBoundingClientRect()));
  if (collidedY) playerEl.style.top = state.pos.y + 'px'; else state.pos.y = ny;

  // coin collection
  for (const c of Array.from(state.coinNodes)) {
    if (rectsOverlap(playerEl.getBoundingClientRect(), c.getBoundingClientRect())) {
      state.coins++;
      coinCountEl.textContent = state.coins;
      c.remove();
      state.coinNodes.delete(c);
    }
  }

  // --- sprite animation (with idle breathing) ---
  const moving = (Math.abs(dx) + Math.abs(dy)) > 0;

  if (moving) {
    // Use dedicated LEFT/RIGHT/UP/DOWN walk strips (no flip here)
    playerEl.classList.remove('flip-x');
    playerEl.classList.remove('idle');

    state.frameTimer += dt;
    if (state.frameTimer >= state.frameDelay) {
      state.frameTimer = 0;
      const frames = ASSETS.walk[state.dir] || [];
      if (frames.length) state.frame = (state.frame + 1) % frames.length;
    }
    const frames = ASSETS.walk[state.dir] || [];
    if (frames.length) spriteImg.src = frames[state.frame].src;

  } else {
    // Idle: reuse side base and mirror ONLY for LEFT
    playerEl.classList.add('idle');
    playerEl.classList.toggle('flip-x', state.dir === DIR.LEFT);

    state.frameTimer = 0;
    state.frame = 0;
    const img = ASSETS.idle[state.dir];
    if (img) spriteImg.src = img.src;
  }
  // ... keep your existing step code ...

  // Transition to east area when the gate is open and player reaches the right edge
{
  const bounds = gameEl.getBoundingClientRect();
  const size = playerEl.getBoundingClientRect();

  const gateGone = !document.getElementById('eastGate');          // already opened/removed
  const nearRight = state.pos.x + size.width >= bounds.width - 2; // hugging the right edge

  if (state.flags.homelessQuestDone && gateGone && nearRight && !state._loadingArea) {
    state._loadingArea = true;              // guard so we don’t double-trigger
    goToEastArea().finally(() => { state._loadingArea = false; });
  }
}


// show/hide talk hint near closest NPC in range
{
  const npc = findNearbyNPC(playerEl, 10);
  if (npc) {
    const el = document.querySelector(`[aria-label="${npc.id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const gr = gameEl.getBoundingClientRect();
      talkHint.style.left = (r.left - gr.left + r.width/2) + 'px';
      talkHint.style.top  = (r.top - gr.top) + 'px';
      talkHint.style.display = 'block';
    }
  } else {
    talkHint.style.display = 'none';
  }
}

}


// --- Loop ---
function loop(t) {
  const dt = Math.min(0.033, (t - state.lastTime) / 1000);
  state.lastTime = t;
  step(dt);
  requestAnimationFrame(loop);
}

// --- Resize safety ---
addEventListener('resize', () => {
  const bounds = gameEl.getBoundingClientRect();
  const size = playerEl.getBoundingClientRect();
  state.pos.x = clamp(state.pos.x, 0, bounds.width - size.width);
  state.pos.y = clamp(state.pos.y, 0, bounds.height - size.height);
  playerEl.style.left = state.pos.x + 'px';
  playerEl.style.top = state.pos.y + 'px';
});

// --- Boot ---
(async function boot() {
  await loadSprites({ playerEl, spriteImg });
  // position player initially
  playerEl.style.left = state.pos.x + 'px';
  playerEl.style.top  = state.pos.y + 'px';
  requestAnimationFrame(loop);
})();
