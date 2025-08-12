// js/ui.js
let box, textEl, hintEl;
let lines = [];
let idx = 0;
let open = false;
let onComplete = null;

// --- Boot ---
(async function boot() {
  initUI(); // <-- ADD THIS
  await loadSprites({ playerEl, spriteImg });
  playerEl.style.left = state.pos.x + 'px';
  playerEl.style.top  = state.pos.y + 'px';
  requestAnimationFrame(loop);
})();


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
