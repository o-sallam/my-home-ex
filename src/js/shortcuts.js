import { CATALOG } from './catalog.js';
import { createIcon, safeColor } from './icons.js';
import iconFiles from './icon-files.json';
import { websiteUrl } from './urls.js';
import { setupDialog } from './dialogs.js';

export function setupShortcuts({ getState, update, notify }) {
  const element = document.querySelector('#shortcut-dialog');
  const dialog = setupDialog(element);
  const form = document.querySelector('#shortcut-form');
  const name = document.querySelector('#shortcut-name');
  const url = document.querySelector('#shortcut-url');
  const color = document.querySelector('#shortcut-color');
  const upload = document.querySelector('#custom-icon');
  const error = document.querySelector('#shortcut-error');
  const preview = document.querySelector('#icon-preview');
  const tabs = [...element.querySelectorAll('[role="tab"]')];
  let index = null;
  let draft = {};
  let session = 0;
  let uploading = false;
  let saving = false;

  function showError(message = '') {
    error.textContent = message;
    error.hidden = !message;
  }

  function setTab(id, focus = false) {
    tabs.forEach((tab) => {
      const selected = tab.id === id;
      tab.setAttribute('aria-selected', selected);
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
      if (focus && selected) tab.focus();
    });
    showError();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => setTab(tab.id));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      setTab(tabs[next].id, true);
    });
  });

  function updatePreview() {
    preview.replaceChildren(createIcon({ ...draft, label: name.value, color: color.value }));
    picker.querySelectorAll('.picker-item').forEach((item) => item.setAttribute('aria-pressed', !draft.image && item.dataset.icon === draft.icon));
  }

  const picker = document.querySelector('#icon-picker');
  Object.keys(iconFiles).forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'picker-item';
    button.dataset.icon = key;
    button.title = key.replace(/^(fab|fas|far) fa-/, '').replace(/-/g, ' ');
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', 'false');
    button.append(createIcon({ icon: key, color: '#3794ff', label: key }));
    button.addEventListener('click', () => {
      draft.icon = key;
      delete draft.image;
      upload.value = '';
      updatePreview();
    });
    picker.append(button);
  });

  async function save(card) {
    if (index === null || saving || uploading) return;
    saving = true;
    const target = index;
    const currentSession = session;
    const saved = await update((state) => { state.cards[target] = card; });
    saving = false;
    if (currentSession !== session) return;
    if (saved) {
      dialog.close();
      notify(card ? `${card.label} saved.` : 'Shortcut removed.');
    } else showError('Could not save this shortcut. Check available storage and try again.');
  }

  const catalog = document.querySelector('#catalog');
  CATALOG.forEach((card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-item';
    button.append(createIcon(card));
    const label = document.createElement('span');
    label.textContent = card.label;
    button.append(label);
    button.addEventListener('click', () => save({ ...card }));
    catalog.append(button);
  });

  name.addEventListener('input', () => { name.setCustomValidity(''); updatePreview(); });
  color.addEventListener('input', updatePreview);
  url.addEventListener('input', () => url.setCustomValidity(''));
  document.querySelector('#clear-icon').addEventListener('click', () => {
    draft.icon = '';
    delete draft.image;
    upload.value = '';
    updatePreview();
  });
  upload.addEventListener('change', async () => {
    const file = upload.files[0];
    if (!file) return;
    showError();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      showError('Choose a PNG, JPG, WebP or GIF image up to 2 MB.');
      upload.value = '';
      return;
    }
    const currentSession = session;
    uploading = true;
    document.querySelector('#save-shortcut').disabled = true;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 25_000_000) throw new Error('Image is too large.');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const scale = Math.min(128 / bitmap.width, 128 / bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, (128 - bitmap.width * scale) / 2, (128 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
      if (currentSession !== session) return;
      // Rasterize locally: uploaded markup is never stored or inserted into DOM.
      draft.image = canvas.toDataURL('image/png');
      draft.icon = '';
      updatePreview();
    } catch {
      if (currentSession === session) showError('This image could not be opened. Try a smaller image or a different file.');
    } finally {
      bitmap?.close();
      if (currentSession === session) {
        uploading = false;
        document.querySelector('#save-shortcut').disabled = false;
      }
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const validUrl = websiteUrl(url.value);
    name.setCustomValidity(name.value.trim() ? '' : 'Enter a shortcut name.');
    url.setCustomValidity(validUrl ? '' : 'Enter a full http:// or https:// address without a username or password.');
    if (!form.reportValidity()) return;
    await save({ ...draft, label: name.value.trim(), url: validUrl, color: color.value });
  });
  document.querySelector('#custom-cancel').addEventListener('click', dialog.close);
  document.querySelector('#remove-shortcut').addEventListener('click', () => save(null));
  element.addEventListener('close', () => {
    // Saving re-renders the grid, replacing the element that opened the dialog.
    // Restore keyboard focus to its replacement before clearing the slot.
    if (index !== null) document.querySelector(`#grid [data-index="${index}"]`)?.focus({ preventScroll: true });
    session++;
    index = null;
  });

  return {
    open(cellIndex) {
      session++;
      index = cellIndex;
      uploading = false;
      saving = false;
      const existing = getState().cards[index];
      draft = existing ? { ...existing } : { icon: '', color: '#75baff' };
      form.reset();
      name.value = existing?.label || '';
      url.value = existing?.url || '';
      color.value = safeColor(draft.color);
      name.setCustomValidity('');
      url.setCustomValidity('');
      document.querySelector('#save-shortcut').disabled = false;
      document.querySelector('#slot-label').textContent = `SHORTCUT ${String(index + 1).padStart(2, '0')}`;
      document.querySelector('#shortcut-title').textContent = existing ? 'Edit shortcut' : 'Add a shortcut';
      document.querySelector('#remove-row').hidden = !existing;
      setTab(existing ? 'custom-tab' : 'catalog-tab');
      updatePreview();
      dialog.open();
    },
  };
}
