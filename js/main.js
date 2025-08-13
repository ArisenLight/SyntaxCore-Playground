// js/main.js
import { DIR, FRAME_W, FRAME_H, ASSETS, loadSprites } from './sprites.js';
import { initUI, isDialogueOpen, showDialogue, advanceDialogue, initInventoryUI, toggleInventory, renderInventory } from './ui.js';
import { npcs, mountNPCs, findNearbyNPC, getDialogueFor } from './npc.js';
import { plantTreesAt, placeTentAt } from './props.js';


// --- Helpers ---
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rectsOverlap = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

function isNearRect(aRect, bRect, pad = 36) {
  // distance between two axis-aligned rectangles (0 when overlapping)
  const dx = Math.max(0, Math.max(bRect.left - aRect.right, aRect.left - bRect.right));
  const dy = Math.max(0, Math.max(bRect.top - aRect.bottom, aRect.top - bRect.bottom));
  return Math.max(dx, dy) <= pad;
}


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

function findNearbyItem(playerEl, margin = 14) {
  const pr = playerEl.getBoundingClientRect();
  for (const el of state.itemNodes) {
    const r = el.getBoundingClientRect();
    const gapX = Math.max(0, Math.max(r.left - pr.right, pr.left - r.right));
    const gapY = Math.max(0, Math.max(r.top - pr.bottom, pr.top - r.bottom));
    if (Math.max(gapX, gapY) <= margin) return el;
  }
  return null;
}

function addToInventory({ id, name, icon }) {
  const slot = state.inventory.find(i => i.id === id);
  if (slot) { slot.qty += 1; }
  else state.inventory.push({ id, name, icon, qty: 1 });
  renderInventory(state.inventory);
}

function spawnItemsArea2() {
  // simple items; y is ground-point like trees/ tent base
  const items = [
    { id:'key',    name:'Old Key',   icon:'🗝️', x: 380, y: 260 },
    { id:'apple',  name:'Apple',     icon:'🍎', x: 320, y: 120 },
  ];
for (const it of items) {
  const n = document.createElement('div');
  n.className = 'item';

  // anchor by base-center (18×18 box)
  const left = Math.round(it.x - 9);
  const top  = Math.round(it.y - 18);
  n.style.left = left + 'px';
  n.style.top  = top + 'px';

  // ✅ show the emoji icon in-world
  n.textContent = it.icon;
  n.title = it.name; // hover tooltip

  n.dataset.itemId = it.id;
  n.dataset.itemName = it.name;
  n.dataset.itemIcon = it.icon;

  gameEl.appendChild(n);
  state.itemNodes.add(n);
}

 // --- Spawn the Scout in Area 2 ---
 const scoutEls = mountNPCs(gameEl, n => n.id === 'scout');
 state.obstacles.push(...scoutEls);

 // Optionally adjust the scout’s position for Area 2 without changing the data:
 const scoutEl = document.querySelector('[aria-label="scout"]');
 if (scoutEl) {
   // Place him near the west edge so the player sees him quickly.
   // Tweak to taste:
   scoutEl.style.left = '120px';
   scoutEl.style.top  = '120px';
 }
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
  flags: { homelessQuestDone: false, scoutHintShown: false },
  currentArea: 1,
  inventory: [],          // array of { id, name, icon, qty }
  itemNodes: new Set(),   // DOM nodes for world items
  dead: false,
};

const talkHint = document.createElement('div');
talkHint.className = 'talk-hint';
talkHint.textContent = 'E';
talkHint.style.cssText = 'position:absolute; padding:2px 4px; font:12px/1 sans-serif; background:rgba(0,0,0,.6); color:#fff; border-radius:4px; transform:translate(-50%,-140%); pointer-events:none; display:none; z-index:9999;';
gameEl.appendChild(talkHint);



// Obstacles present in HTML
state.obstacles = Array.from(document.querySelectorAll('.obstacle'));
// Mount NPCs into the world and also treat them as obstacles
const npcEls = mountNPCs(gameEl, n => n.id === 'homeless' || n.id === 'scout');
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
  state._needExtendTrees = true;
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
    document.querySelectorAll('.tree, .tent, .tent-hitbox, .coin, .npc, .item').forEach(el => el.remove());
    state.coinNodes.clear();

    // 2) Reset obstacles to any remaining static ones (e.g., walls still in HTML)
    state.obstacles = Array.from(document.querySelectorAll('.obstacle'));

    state.obstacles = state.obstacles.filter(el => document.body.contains(el));


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

// Put the top row near the ceiling, and the bottom row right at the ground
const TOP_MARGIN = 6;          // a little breathing room from the top edge
const GROUND_MARGIN = 2;       // how close the trunks sit to the bottom

const topRow    = makeRow(TOP_MARGIN + 60);        // or tweak to taste
const bottomRow = makeRow(bounds.height - GROUND_MARGIN);

const c1 = await plantTreesAt(gameEl, topRow);
const c2 = await plantTreesAt(gameEl, bottomRow);
state.obstacles.push(...c1, ...c2);

spawnItemsArea2();
const t2 = document.createElement('div');
t2.className = 'toast';
t2.textContent = 'New lesson: pick items with E. Press I to open inventory.';
document.querySelector('.game-wrap')?.appendChild(t2);
setTimeout(() => t2.remove(), 3000);

document.getElementById('northGate')?.remove();
const northGate = document.createElement('div');
northGate.id = 'northGate';
northGate.className = 'obstacle gate';
northGate.style.right = '14px'; // adjust to your map
northGate.style.top  = '120px';
northGate.style.width = '22px';
northGate.style.height = '300px';
gameEl.appendChild(northGate);
state.obstacles.push(northGate);


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

  state.currentArea = 2;

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

  
  setTimeout(() => {
    gate.remove();
    // ✅ keep the tent in Area 1 (no clearTents here)
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = 'You hear a heavy bolt slide open to the east...';
    document.querySelector('.game-wrap')?.appendChild(t);
    setTimeout(() => t.remove(), 7000);
  }, 320);
  
}

function openNorthGate() {
  const gate = document.getElementById('northGate');
  if (!gate || gate.classList.contains('opening')) return;
  gate.classList.add('opening');

 // consume one "key" if present
 const slot = state.inventory.find(i => i.id === 'key');
 if (slot) {
   slot.qty -= 1;
   if (slot.qty <= 0) {
     state.inventory = state.inventory.filter(i => i !== slot);
   }
   renderInventory(state.inventory);
 }

  // Remove from obstacles so player can pass
  state.obstacles = state.obstacles.filter(el => el !== gate);
  setTimeout(() => gate.remove(), 300);

 // feedback
 const t = document.createElement('div');
 t.className = 'toast';
 t.textContent = 'Used Old Key. The northern gate unlocks.';
 document.querySelector('.game-wrap')?.appendChild(t);
 setTimeout(() => t.remove(), 1500);
}

async function goToArea3() {
  await fadeTransition(async () => {
    // clear dynamic world
    document.querySelectorAll('.tree, .tent, .tent-hitbox, .coin, .npc, .item, .gate').forEach(el => el.remove());
    state.coinNodes.clear();

    // reset obstacles to static ones
    state.obstacles = Array.from(document.querySelectorAll('.obstacle'));
    state.obstacles = state.obstacles.filter(el => document.body.contains(el));

    // backdrop for area 3
    gameEl.classList.remove('area-east');
    gameEl.classList.add('area-north');

    // border trees for Area 3 (example)
    const bounds = gameEl.getBoundingClientRect();
    const STEP = 60;
    const makeRow = (y) => {
      const pts = [];
      for (let x = 15; x < bounds.width - 20; x += STEP) pts.push({ x, y });
      return pts;
    };
    const TOP = 56, BOTTOM = bounds.height - 2;
    const cTop = await plantTreesAt(gameEl, makeRow(TOP));
    const cBot = await plantTreesAt(gameEl, makeRow(BOTTOM));
    state.obstacles.push(...cTop, ...cBot);

    // spawn scout in Area 3 (optional)
    const scoutEls = mountNPCs(gameEl, n => n.id === 'scout');
    state.obstacles.push(...scoutEls);
    const scoutEl = document.querySelector('[aria-label="scout"]');
    if (scoutEl) {
      scoutEl.style.left = '120px';
      scoutEl.style.top  = (bounds.height - 120) + 'px';
    }

    // player enters from bottom
    state.pos.x = Math.min(Math.max(state.pos.x, 40), bounds.width - 60);
    state.pos.y = bounds.height - playerEl.getBoundingClientRect().height - 2;
    playerEl.style.left = state.pos.x + 'px';
    playerEl.style.top  = state.pos.y + 'px';
  });

  state.currentArea = 3;

  // tip (optional)
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = 'Area 3: (WIP) Explore north!';
  document.querySelector('.game-wrap')?.appendChild(t);
  setTimeout(() => t.remove(), 2000);

  state.currentArea = 3;

// tiny beat then insta-trap
setTimeout(triggerChasmDeath, 350);

}





// --- Input ---
const keyMap = {
  'ArrowUp': 'up',    'KeyW': 'up',
  'ArrowDown': 'down','KeyS': 'down',
  'ArrowLeft': 'left','KeyA': 'left',
  'ArrowRight': 'right','KeyD': 'right',
  'ShiftLeft': 'shift', 'ShiftRight': 'shift',
  'KeyE': 'interact',
  'KeyI': 'inventory',
};

window.addEventListener('keydown', (e) => {
    if (state.dead) {
    // Allow quick restart with "R"
    if (e.code === 'KeyR') {
      location.reload();
    }
    e.preventDefault();
    return;
  }
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

  if (state.keys.has(action)) state.keys.delete(action);

if (action === 'interact') {
  // 1) If dialogue is open, advance it
  if (isDialogueOpen()) {
    advanceDialogue();
    state.keys.delete(action);
    return;
  }

  // 2) Try picking up an item first
  const nearItem = findNearbyItem(playerEl, 14);
  if (nearItem) {
    addToInventory({
      id: nearItem.dataset.itemId,
      name: nearItem.dataset.itemName,
      icon: nearItem.dataset.itemIcon,
    });
    nearItem.remove();
    state.itemNodes.delete(nearItem);

    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = `Picked up ${nearItem.dataset.itemName}`;
    document.querySelector('.game-wrap')?.appendChild(t);
    setTimeout(() => t.remove(), 1500);

    state.keys.delete(action);
    return; // stop here; don't open NPC dialogue on same press
  }

// 2.5) Check for gate opening by key (Area 2 right-side gate)
const northGateEl = document.getElementById('northGate');
if (state.currentArea === 2 && northGateEl) {
  const pr = playerEl.getBoundingClientRect();
  const gr = gameEl.getBoundingClientRect(); // not used here but kept for symmetry
  const grt = northGateEl.getBoundingClientRect();

  if (isNearRect(pr, grt, 36)) {  // generous radius so the collider doesn't block the action
    const slot = state.inventory.find(i => i.id === 'key');
    if (slot) {
      openNorthGate();
    } else {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = "The gate is locked. You need a key.";
      document.querySelector('.game-wrap')?.appendChild(t);
      setTimeout(() => t.remove(), 1500);
    }
    return; // consume the E press
  }
}


  // 3) Otherwise talk to NPC if near
  const npc = findNearbyNPC(playerEl, 10);
  if (npc) {
    const dlg = getDialogueFor(npc, { coins: state.coins, flags: state.flags, area: state.currentArea });

    // face the NPC
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

    return;
  }

  // nothing to do
  return;
}



if (action === 'inventory') {
  toggleInventory();
  return;
}
});




// --- Step ---
function step(dt) {
  if (state.dead) return;

    // If dialogue is open, freeze movement (but idle breathing stays)
if (isDialogueOpen()) {
  // zero movement, keep facing from previous frame
  const img = ASSETS.idle[state.dir];
  playerEl.classList.add('idle');
  playerEl.classList.toggle('flip-x', state.dir === DIR.LEFT);
  if (img) spriteImg.src = img.src;
  return; // skip the rest of 
  
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

  if (state.currentArea === 1 && state.flags.homelessQuestDone && gateGone && nearRight && !state._loadingArea) {
    state._loadingArea = true;              // guard so we don’t double-trigger
    goToEastArea().finally(() => { state._loadingArea = false; });
  }
}


// show/hide talk hint near closest NPC in range
{
  // Prefer item hint if item is closer; otherwise NPC hint
  const itemEl = findNearbyItem(playerEl, 14);
  const npc = itemEl ? null : findNearbyNPC(playerEl, 10);

// Gate hint (Area 2)
const gateEl = state.currentArea === 2 ? document.getElementById('northGate') : null;
if (!itemEl && gateEl) {
  const pr = playerEl.getBoundingClientRect();
  const gr = gameEl.getBoundingClientRect();
  const r  = gateEl.getBoundingClientRect();

  if (isNearRect(pr, r, 36)) {
    const hasKey = state.inventory.some(i => i.id === 'key');
    talkHint.textContent = hasKey ? 'E (unlock)' : 'Locked';
    talkHint.style.left = (r.left - gr.left + r.width/2) + 'px';
    talkHint.style.top  = (r.top  - gr.top) + 'px';
    talkHint.style.display = 'block';
    return;
  }
}


  if (itemEl) {
    const r = itemEl.getBoundingClientRect();
    const gr = gameEl.getBoundingClientRect();
    talkHint.textContent = 'E';
    talkHint.style.left = (r.left - gr.left + r.width/2) + 'px';
    talkHint.style.top  = (r.top  - gr.top) + 'px';
    talkHint.style.display = 'block';
  } else if (npc) {
    const el = document.querySelector(`[aria-label="${npc.id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const gr = gameEl.getBoundingClientRect();
      talkHint.textContent = 'E';
      talkHint.style.left = (r.left - gr.left + r.width/2) + 'px';
      talkHint.style.top  = (r.top - gr.top) + 'px';
      talkHint.style.display = 'block';
    }
  } else {
    talkHint.style.display = 'none';
  }
}

// Transition to Area 3
 const nearRight2 = state.pos.x + playerEl.getBoundingClientRect().width >= gameEl.getBoundingClientRect().width - 2;
 if (state.currentArea === 2 && !document.getElementById('northGate') && nearRight2 && !state._loadingArea) {
  state._loadingArea = true;
  goToArea3().finally(() => state._loadingArea = false);
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
  initUI();
initInventoryUI({
  onUse: (item) => {
    // simple example effect
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = `Used ${item.name}`;
    document.querySelector('.game-wrap')?.appendChild(t);
    setTimeout(() => t.remove(), 1200);

    // consume one
    item.qty -= 1;
    if (item.qty <= 0) state.inventory = state.inventory.filter(i => i !== item);
    renderInventory(state.inventory);
  },
onDrop: (item) => {
  const pr = playerEl.getBoundingClientRect();
  const gr = gameEl.getBoundingClientRect();
  const x = pr.left - gr.left + pr.width/2;
  const y = pr.top  - gr.top  + pr.height; // base

  const n = document.createElement('div');
  n.className = 'item';
  n.style.left = Math.round(x - 9) + 'px';
  n.style.top  = Math.round(y - 18) + 'px';

  // ✅ make it look like the in-world pickups
  n.textContent = item.icon;
  n.title = item.name;
  n.style.background = 'none';
  n.style.border = 'none';
  n.style.boxShadow = 'none';

  n.dataset.itemId = item.id;
  n.dataset.itemName = item.name;
  n.dataset.itemIcon = item.icon;

  gameEl.appendChild(n);
  state.itemNodes.add(n);

  // decrease qty
  item.qty -= 1;
  if (item.qty <= 0) state.inventory = state.inventory.filter(i => i !== item);
  renderInventory(state.inventory);
}

});
renderInventory(state.inventory);

  await loadSprites({ playerEl, spriteImg });
  // position player initially
  playerEl.style.left = state.pos.x + 'px';
  playerEl.style.top  = state.pos.y + 'px';
  requestAnimationFrame(() => {
    if (state._needExtendTrees) {
      extendTrees();
      state._needExtendTrees = false;
    }
  });
  requestAnimationFrame(loop);
})();

function triggerChasmDeath() {
  if (state.dead) return;
  state.dead = true;

  // 1) Darken area (chasm look)
  const chasm = document.createElement('div');
  chasm.className = 'chasm-overlay';
  gameEl.appendChild(chasm);
  requestAnimationFrame(() => { chasm.style.opacity = '1'; });

  // 2) Fall animation for the player
  playerEl.style.willChange = 'transform, opacity';
  playerEl.style.transition = 'transform 650ms ease-in, opacity 650ms ease-in';
  // kick the animation
  requestAnimationFrame(() => {
    playerEl.style.transform = 'translateY(40px) scale(0.1)';
    playerEl.style.opacity = '0';
  });

  // 3) After the "fall", show Game Over
  setTimeout(() => {
    const panel = document.createElement('div');
    panel.className = 'gameover-panel';
    panel.innerHTML = `
      <div class="gameover-card">
        <h2>Game Over</h2>
        <p>You fell into the chasm.</p>
        <button id="btnRestart">Restart</button>
        <div style="margin-top:6px; font-size:12px; opacity:.7">Press <b>R</b> to restart</div>
      </div>
    `;
    document.querySelector('.game-wrap').appendChild(panel);
    requestAnimationFrame(() => { panel.style.opacity = '1'; });

    panel.querySelector('#btnRestart')?.addEventListener('click', () => {
      location.reload();
    });
  }, 720);
}
