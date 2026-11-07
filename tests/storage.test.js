import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, loadState, saveState, STATE_KEY } from '../src/js/storage.js';
import { websiteUrl } from '../src/js/urls.js';

function localStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem: (key) => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value), data };
}
function chromeStore(seed = {}) {
  const data = structuredClone(seed);
  return {
    runtime: { id: 'test-extension' },
    storage: { local: { get: async (key) => ({ [key]: data[key] }), set: async (values) => Object.assign(data, structuredClone(values)) } },
    data,
  };
}
const card = { icon: 'fab fa-github', color: '#123456', label: 'My repository', url: 'https://github.com/example?tab=stars' };

test('web mode migrates the original cards and plain-string list preference without changing original keys', async () => {
  const original = JSON.stringify([card, null]);
  const local = localStore({ home_cards: original, home_view: 'list' });
  const storage = createStorage({ local, extension: false });
  const state = await loadState(storage);
  assert.deepEqual(state.cards, [card, null]);
  assert.equal(state.settings.view, 'list');
  assert.equal(local.getItem('home_cards'), original);
  assert.equal(local.getItem('home_view'), 'list');
  assert.deepEqual(await storage.get(STATE_KEY), state);
});

test('extension migrates localStorage into Chrome storage, retaining all 25 positions and the backup', async () => {
  const cards = Array(25).fill(null);
  cards[24] = card;
  const local = localStore({ home_cards: JSON.stringify(cards), home_view: 'list' });
  const chrome = chromeStore();
  const storage = createStorage({ local, chrome, extension: true });
  const state = await loadState(storage);
  assert.equal(storage.mode, 'extension');
  assert.deepEqual(chrome.data[STATE_KEY].cards, cards);
  assert.deepEqual(state.cards[24], card);
  assert.equal(local.getItem('home_view'), 'list');
  state.settings.gridSize = 3;
  await saveState(storage, state);
  assert.deepEqual((await loadState(storage)).cards[24], card);
});

test('Chrome storage is authoritative over older local backups and supports legacy JSON strings', async () => {
  const chrome = chromeStore({ home_cards: JSON.stringify([card]), home_view: 'grid' });
  const local = localStore({ home_cards: 'invalid old backup' });
  const state = await loadState(createStorage({ chrome, local, extension: true }));
  assert.deepEqual(state.cards, [card]);
});

test('existing v2 Chrome data takes precedence and is not reset on startup', async () => {
  const state = { version: 2, cards: [null, card], settings: { gridSize: 5, view: 'list' } };
  const chrome = chromeStore({ [STATE_KEY]: state });
  const local = localStore({ home_cards: JSON.stringify([]) });
  assert.deepEqual(await loadState(createStorage({ chrome, local, extension: true })), state);
});

test('a normal webpage uses localStorage even if a Chrome-like global is present', async () => {
  const chrome = chromeStore();
  const local = localStore();
  const storage = createStorage({ chrome, local, extension: false });
  await storage.set('test', 1);
  assert.equal(local.getItem('test'), '1');
  assert.deepEqual(chrome.data, {});
});

test('intentionally empty configurations stay empty instead of restoring defaults', async () => {
  const local = localStore({ home_cards: '[]' });
  assert.deepEqual((await loadState(createStorage({ local, extension: false }))).cards, []);
});

test('corrupt legacy/v2 data is never overwritten', async () => {
  for (const [key, value] of [['home_cards', '{bad'], ['home_cards', '{}'], [STATE_KEY, '{"version":2,"cards":null}']]) {
    const local = localStore({ [key]: value });
    await assert.rejects(loadState(createStorage({ local, extension: false })), /kept/);
    assert.equal(local.getItem(key), value);
    if (key !== STATE_KEY) assert.equal(local.getItem(STATE_KEY), null);
  }
});

test('Chrome failures propagate without silently switching to a separate storage backend', async () => {
  const local = localStore();
  const chrome = chromeStore();
  chrome.storage.local.set = async () => { throw new Error('QUOTA'); };
  const storage = createStorage({ chrome, local, extension: true });
  await assert.rejects(storage.set(STATE_KEY, {}), /QUOTA/);
  assert.equal(local.getItem(STATE_KEY), null);
});

test('unsafe URLs and credentials cannot cross the navigation boundary', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/example', 'chrome://settings', '//example.com', 'https://name:secret@example.com', 'https://example.com/\njavascript:x', '<img src=x>', null]) {
    assert.equal(websiteUrl(value), null, String(value));
  }
  assert.equal(websiteUrl('https://example.com/a?q=1#test'), 'https://example.com/a?q=1#test');
  assert.equal(websiteUrl('http://localhost:3000'), 'http://localhost:3000/');
});
