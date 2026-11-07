import { createIcon } from './icons.js';
import { websiteUrl, hostname } from './urls.js';

export function createGrid({ element, onEdit, onMove }) {
  let dragIndex = null;
  let editMode = false;
  let columns = 3;

  function clearDrag() {
    dragIndex = null;
    element.querySelectorAll('.dragging, .drag-over').forEach((cell) => cell.classList.remove('dragging', 'drag-over'));
  }

  function render(state, editing) {
    const focused = element.contains(document.activeElement) ? Number(document.activeElement.closest('.cell')?.dataset.index) : null;
    editMode = editing;
    columns = state.settings.gridSize;
    element.classList.toggle('list-view', state.settings.view === 'list');
    element.classList.toggle('editing', editing);
    element.style.setProperty('--columns', columns);
    element.replaceChildren();
    for (let i = 0; i < columns ** 2; i++) {
      const card = state.cards[i];
      const url = websiteUrl(card?.url);
      const cell = document.createElement(card && !editing && url ? 'a' : 'button');
      const blocked = !editing && !url;
      cell.className = `cell ${card ? 'shortcut' : 'empty-cell'}${blocked ? ' blocked' : ''}`;
      if (blocked) cell.setAttribute('aria-disabled', 'true');
      cell.dataset.index = i;
      if (!document.body.classList.contains('intro')) cell.classList.add('fresh');
      cell.style.setProperty('--i', Math.floor(i / columns) + (i % columns));
      if (cell.tagName === 'A') cell.href = url;
      else cell.type = 'button';
      const name = card ? String(card.label || 'Untitled shortcut') : 'Add shortcut';
      cell.setAttribute('aria-label', blocked ? `${card ? name : 'Empty'}, no link, cell ${i + 1}` : card ? `${editing || !url ? 'Edit ' : ''}${name}, cell ${i + 1}` : `Add shortcut to cell ${i + 1}`);
      cell.title = blocked ? (card ? 'No link yet. Turn on edit mode to set one.' : 'Empty. Turn on edit mode to add a shortcut.') : card ? (editing ? `Edit ${name}` : url || 'Update this shortcut with an http:// or https:// URL') : 'Add a shortcut';
      if (card) {
        const well = document.createElement('span');
        well.className = 'icon-well';
        well.append(createIcon(card));
        cell.append(well);
      } else {
        const plus = document.createElement('span');
        plus.className = 'add-icon';
        if (blocked) plus.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
        else plus.textContent = '+';
        plus.setAttribute('aria-hidden', 'true');
        cell.append(plus);
      }
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = name;
      cell.append(label);
      if (card) {
        const domain = document.createElement('span');
        domain.className = 'cell-domain';
        domain.textContent = hostname(card.url);
        cell.append(domain);
      }
      const hint = document.createElement('span');
      hint.className = 'cell-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = editing && card ? '✎' : i < 9 && card ? i + 1 : '';
      cell.append(hint);
      cell.draggable = Boolean(editing && card);
      element.append(cell);
    }
    if (focused !== null) focusCell(focused);
  }

  function focusCell(index) { element.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true }); }

  element.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (cell?.classList.contains('blocked')) { event.preventDefault(); return; }
    if (cell && cell.tagName !== 'A') onEdit(Number(cell.dataset.index));
  });
  element.addEventListener('dragstart', (event) => {
    const cell = event.target.closest('.cell');
    if (!editMode || !cell?.draggable) { event.preventDefault(); return; }
    dragIndex = Number(cell.dataset.index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(dragIndex));
    cell.classList.add('dragging');
  });
  element.addEventListener('dragover', (event) => {
    const cell = event.target.closest('.cell');
    if (dragIndex === null || !cell) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    element.querySelector('.drag-over')?.classList.remove('drag-over');
    cell.classList.add('drag-over');
  });
  element.addEventListener('drop', async (event) => {
    event.preventDefault();
    const cell = event.target.closest('.cell');
    const from = dragIndex;
    clearDrag();
    if (from !== null && cell) await onMove(from, Number(cell.dataset.index));
  });
  element.addEventListener('dragend', clearDrag);
  element.addEventListener('keydown', async (event) => {
    if (!editMode || !event.altKey || !event.key.startsWith('Arrow')) return;
    const cell = event.target.closest('.cell');
    if (!cell) return;
    const from = Number(cell.dataset.index);
    const step = element.classList.contains('list-view') ? 1 : columns;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -step, ArrowDown: step }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const to = from + delta;
    if (to < 0 || to >= columns ** 2) return;
    if (await onMove(from, to)) focusCell(to);
  });

  return { render };
}
