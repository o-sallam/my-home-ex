import { CATALOG } from './catalog.js';
import { createIcon, safeColor } from './icons.js';
import iconFiles from './icon-files.json';
import { websiteUrl } from './urls.js';
import { setupDialog } from './dialogs.js';

export function setupShortcuts({ getState, update, notify, getUsage = () => null, lock }) {
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
  const L = globalThis.LimitsCore;
  const scheduleOn = document.querySelector('#schedule-enabled');
  // 12-hour time picker (hour, minute, AM/PM). Its value is "HH:MM" in 24-hour form.
  function timePicker(host) {
    const make = (label, options) => {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `${host.dataset.label} ${label}`);
      for (const [value, text] of options) select.append(new Option(text, value));
      host.append(select);
      return select;
    };
    const hour = make('hour', Array.from({ length: 12 }, (_, i) => [String(i + 1), String(i + 1)]));
    const minute = make('minute', Array.from({ length: 60 }, (_, i) => [String(i), String(i).padStart(2, '0')]));
    const period = make('AM or PM', [['AM', 'AM'], ['PM', 'PM']]);
    return {
      get value() {
        const h = (Number(hour.value) % 12) + (period.value === 'PM' ? 12 : 0);
        return `${String(h).padStart(2, '0')}:${String(Number(minute.value)).padStart(2, '0')}`;
      },
      set value(time) {
        const [h, m] = time.split(':').map(Number);
        hour.value = String(h % 12 === 0 ? 12 : h % 12);
        minute.value = String(m);
        period.value = h >= 12 ? 'PM' : 'AM';
      },
      addEventListener: (type, handler) => host.addEventListener('change', handler),
    };
  }
  const scheduleStart = timePicker(document.querySelector('#schedule-start'));
  const scheduleEnd = timePicker(document.querySelector('#schedule-end'));
  const limitOn = document.querySelector('#limit-enabled');
  const limitPreset = document.querySelector('#limit-preset');
  const limitCustom = document.querySelector('#limit-custom');
  const usageText = document.querySelector('#usage-today');
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

  function syncRestrictions() {
    document.querySelector('#schedule-fields').hidden = !scheduleOn.checked;
    document.querySelector('#limit-fields').hidden = !limitOn.checked;
    document.querySelector('#limit-custom-label').hidden = limitPreset.value !== 'custom';
    limitCustom.setCustomValidity('');
    const host = L?.hostOfUrl(url.value);
    const now = new Date();
    const usedSeconds = host ? L.usedToday(getUsage(), host, now) : 0;
    const minutes = limitMinutes();
    const parts = [];
    if (host) parts.push(`Today: ${L.formatDuration(usedSeconds)} used`);
    if (limitOn.checked && minutes) parts.push(`${L.formatDuration(Math.max(0, minutes * 60 - usedSeconds))} left`);
    usageText.textContent = parts.join(' · ');
    usageText.hidden = !parts.length || !(limitOn.checked || usedSeconds > 0);
  }
  function limitMinutes() {
    const value = limitPreset.value === 'custom' ? Number(limitCustom.value) : Number(limitPreset.value);
    return Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null;
  }
  function readLimits() {
    const limits = {};
    if (scheduleOn.checked) limits.schedule = { enabled: true, start: scheduleStart.value, end: scheduleEnd.value };
    if (limitOn.checked) limits.daily = { enabled: true, minutes: limitMinutes() };
    return limits.schedule || limits.daily ? limits : null;
  }
  function loadLimits(limits) {
    scheduleOn.checked = Boolean(limits?.schedule?.enabled);
    scheduleStart.value = limits?.schedule?.start || '18:00';
    scheduleEnd.value = limits?.schedule?.end || '19:00';
    limitOn.checked = Boolean(limits?.daily?.enabled);
    const minutes = Number(limits?.daily?.minutes) || 15;
    if ([10, 15, 30, 60].includes(minutes)) { limitPreset.value = String(minutes); limitCustom.value = '45'; }
    else { limitPreset.value = 'custom'; limitCustom.value = String(minutes); }
    syncRestrictions();
  }
  for (const control of [scheduleOn, scheduleStart, scheduleEnd, limitOn, limitPreset, limitCustom]) control.addEventListener('input', syncRestrictions);
  url.addEventListener('input', syncRestrictions);

  // Schedules and limits are read-only until the password has been entered.
  const lockRow = document.querySelector('#restrictions-lock');
  const limitFields = document.querySelector('#restrictions-fields');
  function setLimitsLocked(locked) {
    limitFields.disabled = locked;
    lockRow.hidden = !locked;
  }
  document.querySelector('#restrictions-unlock').addEventListener('click', async () => {
    if (await lock.ensureUnlocked()) setLimitsLocked(false);
  });

  async function save(card) {
    if (index === null || saving || uploading) return;
    // Every save path (form, catalog, remove) re-checks the password if the shortcut already has restrictions.
    if (getState().cards[index]?.limits && !(await lock.ensureUnlocked())) return;
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
    if (scheduleOn.checked && scheduleStart.value === scheduleEnd.value) { showError('Choose different start and end times.'); return; }
    showError();
    if (limitOn.checked && !limitMinutes()) limitCustom.setCustomValidity('Enter a whole number of minutes from 1 to 1440.');
    if (!form.reportValidity()) return;
    // Adding restrictions the first time is free; changing or removing existing ones needs the password.
    if (getState().cards[index]?.limits && !(await lock.ensureUnlocked())) return;
    const saved = { ...draft, label: name.value.trim(), url: validUrl, color: color.value };
    const limits = readLimits();
    if (limits) saved.limits = limits; else delete saved.limits;
    await save(saved);
  });
  document.querySelector('#custom-cancel').addEventListener('click', dialog.close);
  document.querySelector('#remove-shortcut').addEventListener('click', async () => {
    if (getState().cards[index]?.limits && !(await lock.ensureUnlocked())) return;
    save(null);
  });
  element.addEventListener('close', () => {
    // Saving re-renders the grid, replacing the element that opened the dialog.
    // Restore keyboard focus to its replacement before clearing the slot.
    if (index !== null) document.querySelector(`#grid [data-index="${index}"]`)?.focus({ preventScroll: true });
    session++;
    index = null;
    lock.relock();
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
      loadLimits(existing?.limits);
      setLimitsLocked(Boolean(existing?.limits) && !lock.isUnlocked());
      updatePreview();
      dialog.open();
    },
  };
}
