// Synthesizes the sounds as tiny WAV files and plays them with <audio>.
const RATE = 22050;

function wav(from, to, length, volume) {
  const count = Math.floor(RATE * length);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, count * 2, true);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    phase += (2 * Math.PI * (from * Math.pow(to / from, Math.min(1, t / 0.8)))) / RATE;
    const envelope = Math.min(1, i / (RATE * 0.004)) * Math.pow(1 - t, 2.2);
    view.setInt16(44 + i * 2, Math.sin(phase) * envelope * volume * 32767, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const sounds = { tick: wav(1900, 1200, 0.05, 0.35), pop: wav(900, 380, 0.1, 0.5) };

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen' || !sounds[message.kind]) return false;
  new Audio(sounds[message.kind]).play().then(() => sendResponse(true), () => sendResponse(false));
  return true;
});
