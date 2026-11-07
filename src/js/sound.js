// Tiny synthesized "tick": no audio files, so nothing extra to load or ship.
let ctx;
let last = 0;
const KEY = 'home-sound';

export function soundEnabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundEnabled(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

export function tick() { blip('tick', 1900, 1200, 0.045, 0.06, 35); }

// Slightly lower, softer "pop" for activating a card.
export function pop() { blip('pop', 900, 380, 0.09, 0.09, 0); }

function blip(kind, from, to, length, volume, gap) {
  if (!soundEnabled()) return;
  const now = performance.now();
  if (now - last < gap) return;
  last = now;
  // Preferred path: the extension's offscreen document may play without a prior gesture.
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    chrome.runtime.sendMessage({ type: 'ui-sound', kind }).then((ok) => { if (!ok) local(from, to, length, volume); }, () => local(from, to, length, volume));
    return;
  }
  local(from, to, length, volume);
}

function local(from, to, length, volume) {
  // Fallback: browsers keep audio blocked until the user has pressed a key or clicked.
  if (!navigator.userActivation?.hasBeenActive && !ctx) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'running') play(from, to, length, volume);
    else if (navigator.userActivation?.hasBeenActive) ctx.resume().then(() => play(from, to, length, volume), () => {});
  } catch { /* audio unavailable */ }
}

function play(from, to, length, volume) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length * 0.8);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.01);
}

// Prepare the audio engine on the first real gesture so the very first sound isn't lost.
for (const type of ['pointerdown', 'keydown']) {
  addEventListener(type, () => {
    try { ctx ??= new AudioContext(); if (ctx.state !== 'running') ctx.resume().catch(() => {}); } catch { /* unavailable */ }
  }, { once: true, capture: true });
}
