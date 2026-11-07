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

let creating = null;

async function sendToOffscreen(kind) {
  // The new document may not have registered its listener yet; retry briefly.
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      if (await chrome.runtime.sendMessage({ target: 'offscreen', kind })) return true;
    } catch { /* not ready yet */ }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'ui-sound') return false;
  (async () => {
    const url = chrome.runtime.getURL(OFFSCREEN);
    const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
    if (!existing.length) {
      // While the document is starting, drop ticks so they don't all burst out at once.
      if (creating) return message.kind === 'tick';
      creating = ensureOffscreen().finally(() => { creating = null; });
      await creating;
    }
    return sendToOffscreen(message.kind);
  })().then(sendResponse, () => sendResponse(false));
  return true;
});
