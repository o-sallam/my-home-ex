// Plays UI sounds through an offscreen document. Offscreen documents created for
// AUDIO_PLAYBACK are allowed to make sound without a prior click or key press,
// which a new-tab page is not.
const OFFSCREEN = 'offscreen.html';

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN);
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (existing.length) return;
  try {
    await chrome.offscreen.createDocument({ url: OFFSCREEN, reasons: ['AUDIO_PLAYBACK'], justification: 'Play short interface sounds.' });
  } catch (error) {
    // Two sounds can race to create the document; that is fine.
    if (!/single offscreen|already exists/i.test(String(error?.message))) throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'ui-sound') return false;
  ensureOffscreen()
    .then(() => chrome.runtime.sendMessage({ target: 'offscreen', kind: message.kind }))
    .then(() => sendResponse(true), () => sendResponse(false));
  return true;
});
