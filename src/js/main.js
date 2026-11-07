import '../css/style.css';
import '../css/animations.css';
import { createStorage, loadState, saveState } from './storage.js';
import { createGrid } from './grid.js';
import { setupSettings } from './settings.js';
import { setupShortcuts } from './shortcuts.js';
import { websiteUrl } from './urls.js';

const home = document.querySelector('#home');
const notice = document.querySelector('#notice');
let noticeTimer;
function notify(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 4500);
}

async function start() {
  const storage = createStorage();
  let state = await loadState(storage);
  let editMode = false;
  let saving = false;
  const getState = () => state;

  // Commit to storage before updating the screen, so a quota/write failure never
  // looks like a successful save. Small grids never truncate the saved array.
  async function update(change) {
    if (saving) return false;
    saving = true;
    try {
      const next = structuredClone(state);
      change(next);
      await saveState(storage, next);
      state = next;
      render();
      return true;
    } catch {
      notify('Changes could not be saved. Check available browser storage and try again.');
      return false;
    } finally { saving = false; }
  }

  const shortcuts = setupShortcuts({ getState, update, notify });
  const grid = createGrid({
    element: document.querySelector('#grid'),
    onEdit: shortcuts.open,
    onMove: async (from, to) => {
      if (from === to) return false;
      return update((next) => {
        // Swap cells, preserving both shortcuts and intentional empty positions.
        [next.cards[from], next.cards[to]] = [next.cards[to] ?? null, next.cards[from] ?? null];
      });
    },
  });

  function render() {
    grid.render(state, editMode);
    document.querySelector('.workspace').style.setProperty('--columns', state.settings.gridSize);
    document.querySelector('#edit-toggle').setAttribute('aria-pressed', editMode);
    document.querySelector('#edit-toggle').textContent = editMode ? 'Done editing' : 'Edit shortcuts';
    document.querySelector('#edit-help').hidden = !editMode;
    document.querySelector('#keyboard-hint').hidden = editMode;
    for (const view of ['grid', 'list']) {
      document.querySelector(`#view-${view}`).setAttribute('aria-pressed', state.settings.view === view);
    }
    document.querySelector('#grid-summary').textContent = `${state.settings.gridSize} × ${state.settings.gridSize} ${state.settings.view === 'list' ? 'in list view' : 'grid'}`;
  }

  setupSettings({ getState, update });
  document.querySelector('#edit-toggle').addEventListener('click', () => { editMode = !editMode; render(); });
  for (const view of ['grid', 'list']) {
    document.querySelector(`#view-${view}`).addEventListener('click', () => update((next) => { next.settings.view = view; }));
  }
  document.addEventListener('keydown', (event) => {
    if (editMode || document.querySelector('dialog[open]') || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !/^[1-9]$/.test(event.key)) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    const url = websiteUrl(state.cards[Number(event.key) - 1]?.url);
    if (url) window.location.assign(url);
  });

  render();
  home.setAttribute('aria-busy', 'false');
}

start().catch((error) => {
  home.setAttribute('aria-busy', 'false');
  const message = document.createElement('p');
  message.className = 'fatal-error';
  message.setAttribute('role', 'alert');
  message.textContent = `${error.message || 'Your saved data could not be loaded.'} Reload the page to try again.`;
  home.replaceChildren(message);
  document.querySelector('#settings-open').disabled = true;
});
