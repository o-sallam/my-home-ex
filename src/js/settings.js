import { setupDialog } from './dialogs.js';
import { sortByUsage } from './usage.js';

export function setupSettings({ getState, update, lock }) {
  const dialog = setupDialog(document.querySelector('#settings-dialog'));
  const options = document.querySelector('#grid-options');
  const passwordRow = document.querySelector('#password-row');
  passwordRow.hidden = !lock?.enabled;
  document.querySelector('#change-password').addEventListener('click', () => lock.changePassword());
  const autoSort = document.querySelector('#auto-sort');
  autoSort.addEventListener('change', () => update((state) => { state.settings.autoSort = autoSort.checked; if (autoSort.checked) sortByUsage(state.cards); }));
  document.querySelector('#settings-open').addEventListener('click', () => {
    autoSort.checked = getState().settings.autoSort;
    options.querySelector(`input[value="${getState().settings.gridSize}"]`).checked = true;
    dialog.open();
  });
  options.addEventListener('change', async (event) => {
    const size = Number(event.target.value);
    if (![3, 4, 5].includes(size)) return;
    options.querySelectorAll('input').forEach((input) => { input.disabled = true; });
    await update((state) => { state.settings.gridSize = size; });
    options.querySelector(`input[value="${getState().settings.gridSize}"]`).checked = true;
    options.querySelectorAll('input').forEach((input) => { input.disabled = false; });
  });
}
