import { createIcon } from './icons.js';
import { websiteUrl, hostname } from './urls.js';
import { tick, pop } from './sound.js';

export function createGrid({ element, onEdit, onMove, onOpen }) {
  let dragIndex = null;
  let editMode = false;
  let columns = 3;

  function clearDrag() {
    dragIndex = null;
    element.querySelectorAll('.dragging, .drag-over').forEach((cell) => cell.classList.remove('dragging', 'drag-over'));
  }

  function tipFor(card, i, editing, status, blocked, name) {
    const domain = card ? hostname(card.url) : '';
    let tip = name; let sub = ''; let key = '';
    if (blocked && status?.blocked) sub = status.lines.join('\n');
    else if (blocked) { tip = card ? name : 'Empty slot'; sub = card ? 'No link yet. Turn on edit mode to set one.' : 'Turn on edit mode to add a shortcut'; }
    else if (editing) { tip = card ? `Edit ${name}` : 'Add a shortcut'; sub = card ? [domain, ...(status?.lines || [])].join('\n') : `Cell ${i + 1}`; }
    else { sub = [card?.opens ? `${domain} · opened ${card.opens}×` : domain, ...(status?.lines || [])].join('\n'); key = i < 9 ? String(i + 1) : ''; }
    return { tip, sub, key };
  }

  // Update tooltip text in place (no redraw) when only the numbers changed.
  function refresh(state, editing, statuses = []) {
    element.querySelectorAll('.cell').forEach((cell) => {
      const i = Number(cell.dataset.index);
      const card = state.cards[i];
      const name = card ? String(card.label || 'Untitled shortcut') : 'Add shortcut';
      const info = tipFor(card, i, editing, statuses[i], cell.classList.contains('blocked'), name);
      cell.dataset.tip = info.tip; cell.dataset.tipSub = info.sub; cell.dataset.tipKey = info.key;
      const meta = cell.querySelector('.cell-meta');
      if (meta) meta.textContent = (statuses[i]?.lines || []).join(' · ');
    });
  }

  function render(state, editing, statuses = []) {
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
      const cell = document.createElement('button');
      const status = card ? statuses[i] : undefined;
      const restricted = !editing && Boolean(status?.blocked);
      const blocked = !editing && (!url || restricted);
      cell.className = `cell ${card ? 'shortcut' : 'empty-cell'}${blocked ? ' blocked' : ''}`;
      if (blocked) cell.setAttribute('aria-disabled', 'true');
      cell.dataset.index = i;
      if (!document.body.classList.contains('intro')) cell.classList.add('fresh');
      cell.style.setProperty('--i', Math.floor(i / columns) + (i % columns));
      cell.type = 'button';
      // No href: the browser would show the destination in its status bar on hover.
      if (card && !editing && url) { cell.dataset.url = url; cell.setAttribute('role', 'link'); }
      const name = card ? String(card.label || 'Untitled shortcut') : 'Add shortcut';
      cell.setAttribute('aria-label', restricted ? `${name}, blocked right now, cell ${i + 1}` : blocked ? `${card ? name : 'Empty'}, no link, cell ${i + 1}` : card ? `${editing || !url ? 'Edit ' : ''}${name}, cell ${i + 1}` : `Add shortcut to cell ${i + 1}`);
      const info = tipFor(card, i, editing, status, blocked, name);
      cell.dataset.tip = info.tip; cell.dataset.tipSub = info.sub; cell.dataset.tipKey = info.key;
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
        const meta = document.createElement('span');
        meta.className = 'cell-meta';
        meta.textContent = (status?.lines || []).join(' · ');
        cell.append(meta);
        if (status) {
          const badge = document.createElement('span');
          badge.className = `cell-badge${status.blocked ? ' is-blocked' : ''}`;
          badge.setAttribute('aria-hidden', 'true');
          badge.innerHTML = status.blocked
            ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
            : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>';
          cell.append(badge);
        }
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

  // Expanding wave from the pointer (or the center for keyboard activation).
  function ripple(cell, event) {
    const box = cell.getBoundingClientRect();
    const keyboard = event.detail === 0;
    const x = keyboard ? box.width / 2 : event.clientX - box.left;
    const y = keyboard ? box.height / 2 : event.clientY - box.top;
    const radius = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
    const wave = document.createElement('span');
    wave.className = 'ripple';
    wave.setAttribute('aria-hidden', 'true');
    Object.assign(wave.style, { left: `${x - radius}px`, top: `${y - radius}px`, width: `${radius * 2}px`, height: `${radius * 2}px` });
    wave.style.setProperty('--ripple', cell.querySelector('.brand-icon')?.style.getPropertyValue('--icon-color') || '#3794ff');
    cell.append(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  }

  function focusCell(index) { element.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true }); }

  element.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (cell?.classList.contains('blocked')) { event.preventDefault(); return; }
    if (!cell) return;
    const url = cell.dataset.url;
    pop();
    ripple(cell, event);
    if (!url) { onEdit(Number(cell.dataset.index)); return; }
    const index = Number(cell.dataset.index);
    if (event.ctrlKey || event.metaKey || event.shiftKey) { onOpen(index, true); window.open(url, '_blank', 'noopener,noreferrer'); return; }
    onOpen(index, false);
    // Let the press animation play before the page changes.
    cell.style.setProperty('--icon-color', cell.querySelector('.brand-icon')?.style.getPropertyValue('--icon-color') || '#3794ff');
    cell.classList.add('launching');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => window.location.assign(url), reduced ? 0 : 200);
  });
  element.addEventListener('auxclick', (event) => {
    const url = event.button === 1 ? event.target.closest('.cell')?.dataset.url : null;
    if (!url) return;
    event.preventDefault();
    onOpen(Number(event.target.closest('.cell').dataset.index), true);
    window.open(url, '_blank', 'noopener,noreferrer');
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
  // Arrow keys / Home / End move focus between cells (no wrapping).
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    if (document.querySelector('dialog[open]') || !document.querySelector('#context-menu').hidden) return;
    const current = event.target.closest?.('.cell');
    if (!current && event.target !== document.body) return;
    const total = columns ** 2;
    const list = element.classList.contains('list-view');
    const step = list ? 1 : columns;
    const from = current ? Number(current.dataset.index) : -1;
    let to;
    if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = total - 1;
    else if (from < 0) to = 0;
    else {
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -step, ArrowDown: step }[event.key];
      to = from + delta;
      if (!list && ((event.key === 'ArrowLeft' && from % columns === 0) || (event.key === 'ArrowRight' && from % columns === columns - 1))) to = from;
      if (to < 0 || to >= total) to = from;
    }
    event.preventDefault();
    if (to !== from) tick();
    focusCell(to);
  });
  let hovered = null;
  element.addEventListener('mouseover', (event) => {
    const cell = event.target.closest('.cell');
    if (cell === hovered) return;
    hovered = cell;
    if (cell) tick();
  });
  element.addEventListener('mouseleave', () => { hovered = null; });
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

  return { render, refresh };
}
