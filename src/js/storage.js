import { DEFAULT_CARDS } from './catalog.js';

export const STATE_KEY = 'home_state_v2';

// Both backends expose the same promise-based API. A webpage's incidental
// `chrome` object must never cause it to use extension storage.
export function createStorage({
  chrome = globalThis.chrome,
  local = globalThis.localStorage,
  extension = globalThis.location?.protocol === 'chrome-extension:',
} = {}) {
  const area = extension && chrome?.runtime?.id && chrome?.storage?.local;
  function readLocal(key) {
    const raw = local.getItem(key);
    if (raw === null) return undefined;
    try { return JSON.parse(raw); }
    catch {
      // home_view was a plain string in version 1.
      if (key === 'home_view' && ['grid', 'list'].includes(raw)) return raw;
      throw new Error(`Saved data (${key}) could not be read. Your original data has been kept.`);
    }
  }
  return {
    mode: area ? 'extension' : 'web',
    async get(key) { return area ? (await area.get(key))[key] : readLocal(key); },
    async set(key, value) {
      if (area) await area.set({ [key]: value });
      else local.setItem(key, JSON.stringify(value));
    },
    // Original versions used localStorage even inside Chrome. Leave those keys
    // untouched as a recovery copy after the first successful migration.
    readLegacy: readLocal,
  };
}

export async function loadState(storage) {
  const saved = await storage.get(STATE_KEY);
  if (saved !== undefined) {
    if (saved?.version !== 2 || !Array.isArray(saved.cards)) {
      throw new Error('Saved settings could not be read. Your original data has been kept.');
    }
    return {
      ...saved,
      settings: {
        ...saved.settings,
        gridSize: [3, 4, 5].includes(saved.settings?.gridSize) ? saved.settings.gridSize : 3,
        view: saved.settings?.view === 'list' ? 'list' : 'grid',
        autoSort: saved.settings?.autoSort !== false,
      },
    };
  }

  let cards = await storage.get('home_cards');
  let view = await storage.get('home_view');
  if (storage.mode === 'extension') {
    if (cards === undefined) cards = storage.readLegacy('home_cards');
    if (view === undefined) view = storage.readLegacy('home_view');
  }
  // Accommodate a JSON string copied into chrome.storage by an older build.
  if (typeof cards === 'string') {
    try { cards = JSON.parse(cards); } catch { /* handled below */ }
  }
  if (cards !== undefined && !Array.isArray(cards)) {
    throw new Error('Your saved shortcuts could not be read. Your original data has been kept.');
  }
  const state = {
    version: 2,
    cards: cards ?? structuredClone(DEFAULT_CARDS),
    settings: { gridSize: 3, view: view === 'list' ? 'list' : 'grid', autoSort: true },
  };
  if (cards !== undefined || view !== undefined) await storage.set(STATE_KEY, state);
  return state;
}

// The enforcement rules live under their own small key so content scripts never
// need to read the whole state.
export async function saveState(storage, state) {
  await storage.set(STATE_KEY, state);
  const core = globalThis.LimitsCore;
  if (core) await storage.set(core.RULES_KEY, core.deriveRules(state.cards));
}
