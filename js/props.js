// js/props.js

export async function plantTreesAt(gameEl, placements) {
  const colliders = [];
  const treeSrc = 'assets/pine_tree.png';

  // single, clean tree from your sheet (right column)
  const treeRect = { sx: 288, sy: 79, sw: 64, sh: 63 }; 
  const scale = 1;

  const { url, w, h } = await cutTree(treeSrc, treeRect, scale);

  for (const { x, y } of placements) {
    // Interpret {x,y} as the ground point (bottom center of the tree)
    const baseY = Math.max(y, h + 2);                // keep fully on-screen if y is very small
    const left  = Math.round(x - w / 2);             // bottom-center anchor
    const top   = Math.round(baseY - h);

    const el = document.createElement('div');
    el.className = 'tree';
    el.style.position = 'absolute';
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.background = `url('${url}') no-repeat 0 0 / ${w}px ${h}px`;
    el.style.imageRendering = 'pixelated';
    el.style.pointerEvents = 'none';
    el.style.zIndex = String(100 + Math.floor(baseY)); // depth by ground point

    // trunk collider (centered at base)
    const trunk = document.createElement('div');
    trunk.style.position = 'absolute';
    trunk.style.left = '50%';
    trunk.style.transform = 'translateX(-50%)';
    trunk.style.bottom = '2px';
    trunk.style.width = `${Math.floor(w * 0.28)}px`;
    trunk.style.height = `${Math.floor(h * 0.18)}px`;
    trunk.style.background = 'transparent';

    el.appendChild(trunk);
    gameEl.appendChild(el);
    colliders.push(trunk);
  }


  return colliders;
}

// --- helpers used above (keep these once in the file) ---
async function cutTree(src, rect, scale = 1) {
  const img = await loadImage(src);
  const off = document.createElement('canvas');
  off.width = rect.sw * scale;
  off.height = rect.sh * scale;

  const ctx = off.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, off.width, off.height);
  chromaKeyCanvas(off, 8);

  return { url: off.toDataURL(), w: off.width, h: off.height };
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function chromaKeyCanvas(canvas, tolerance = 8) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;

  // sample bg from top-left
  const r0 = data[0], g0 = data[1], b0 = data[2];
  const tol2 = tolerance * tolerance;

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - r0;
    const dg = data[i + 1] - g0;
    const db = data[i + 2] - b0;
    if (dr*dr + dg*dg + db*db <= tol2) data[i + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
}

export async function placeTentAt(gameEl, positions, opts = {}) {
  const src = opts.src ?? 'assets/tent.png';
  const tolerance = opts.tolerance ?? 12;   // increase if a halo remains
  const scale = opts.scale ?? 1;

  // Load + cut out background to a data URL
  const img = await loadImage(src);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  chromaKeyCanvas(off, tolerance);          // <- removes solid bg
  const url = off.toDataURL();

  const colliders = [];

  for (const { x, y } of positions) {
    // Visual tent
    const el = document.createElement('div');
    el.className = 'tent tent-prop'; // <-- added tent-prop class for cleanup
    el.style.cssText = `
      position:absolute;
      left:${x}px; top:${y - h}px;           /* anchor: bottom-left */
      width:${w}px; height:${h}px;
      background:url('${url}') no-repeat 0 0 / ${w}px ${h}px;
      image-rendering: pixelated;
      z-index:${100 + Math.floor(y)};
      pointer-events:none;
    `;
    gameEl.appendChild(el);

    // Base hitbox
    const baseH = Math.floor(h * (opts.baseHeightFrac ?? 0.22));
    const baseW = Math.floor(w * (opts.baseWidthFrac ?? 0.6));
    const hit = document.createElement('div');
    hit.className = 'tent-hitbox obstacle'; // <-- added tent-hitbox class
    hit.style.cssText = `
      position:absolute;
      left:${x + Math.floor((w - baseW) / 2)}px;
      top:${y - baseH}px;                    /* sits at the bottom */
      width:${baseW}px; height:${baseH}px;
    `;
    gameEl.appendChild(hit);
    colliders.push(hit);
  }

  return colliders;
}
