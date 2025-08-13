// js/ui.js
let box, textEl, hintEl;
let lines = [];
let idx = 0;
let open = false;
let onComplete = null;




export function initUI() {
  // Create a minimal dialogue box
  box = document.createElement('div');
  box.id = 'dialogue-box';
  box.style.cssText = `
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
    max-width: 600px; width: calc(100vw - 40px);
    background: rgba(17,24,39,0.95);
    border: 2px solid #a78bfa; border-radius: 10px;
    padding: 12px 14px; color: #e5e7eb; font-size: 16px; line-height: 1.4;
    box-shadow: 0 12px 30px rgba(0,0,0,.4);
    display: none; z-index: 9999;
  `;

  textEl = document.createElement('div');
  hintEl = document.createElement('div');
  hintEl.style.cssText = 'opacity:.7; font-size:13px; margin-top:6px;';
  hintEl.textContent = 'Press E to continue';

  box.appendChild(textEl);
  box.appendChild(hintEl);
  document.body.appendChild(box);
}

export function isDialogueOpen() {
  return open;
}

export function showDialogue(scriptLines, onDone) {
  lines = scriptLines.slice();
  idx = 0;
  onComplete = onDone || null;
  open = true;
  box.style.display = 'block';
  textEl.textContent = lines[idx] ?? '';
}

export function advanceDialogue() {
  if (!open) return;
  idx++;
  if (idx >= lines.length) {
    // close
    box.style.display = 'none';
    open = false;
    if (onComplete) onComplete();
    return;
  }
  textEl.textContent = lines[idx];
}

// ADD at top-level in ui.js
let invBox;
let invOnUse = null;
let invOnDrop = null;

export function initInventoryUI({ onUse, onDrop } = {}) {
  invOnUse = onUse || (()=>{});
  invOnDrop = onDrop || (()=>{});

  invBox = document.createElement('div');
  invBox.id = 'inventory';
  invBox.innerHTML = `<h3>Inventory <span style="opacity:.7;font-size:12px">(I to close)</span></h3><div id="invList"></div>`;
  document.body.appendChild(invBox);
}

export function toggleInventory(show) {
  if (!invBox) return;
  const want = typeof show === 'boolean' ? show : invBox.style.display === 'none';
  invBox.style.display = want ? 'block' : 'none';
}

export function renderInventory(items = []) {
  const list = invBox?.querySelector('#invList');
  if (!list) return;
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = `<div style="opacity:.8;font-size:13px">Empty. Pick items up with <b>E</b>.</div>`;
    return;
  }
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'inv-row';
    row.innerHTML = `
      <div class="name">${it.icon ?? '🎒'} ${it.name} ${it.qty>1?`×${it.qty}`:''}</div>
      <div>
        <button data-act="use">Use</button>
        <button data-act="drop">Drop</button>
      </div>
    `;
    row.querySelector('[data-act="use"]').onclick = () => invOnUse(it);
    row.querySelector('[data-act="drop"]').onclick = () => invOnDrop(it);
    list.appendChild(row);
  }
}
