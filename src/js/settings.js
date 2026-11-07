import { setupDialog } from './dialogs.js';

export function setupSettings({ getState, update }) {
  const dialog = setupDialog(document.querySelector('#settings-dialog'));
  const options = document.querySelector('#grid-options');
  document.querySelector('#settings-open').addEventListener('click', () => {
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
