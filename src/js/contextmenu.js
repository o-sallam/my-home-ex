import { websiteUrl } from './urls.js';
import { soundEnabled, setSoundEnabled, tick } from './sound.js';

const ICONS = {
  open: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  tab: 'M3 6h18v13H3zM3 10h18M8 6v4',
  edit: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  add: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  gear: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  reload: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
};

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'menu-icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (name) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICONS[name]);
    svg.append(path);
  }
  return svg;
}

export function setupContextMenu({ getState, isEditing, toggleEdit, setView, setGridSize, openBookmarks, openShortcut, removeShortcut, openSettings, notify }) {
  const menu = document.querySelector('#context-menu');

  function hide() { menu.hidden = true; menu.replaceChildren(); }

  function item(label, { icon: name, key, check, danger, onClick }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.className = `menu-item${danger ? ' danger-item' : ''}`;
    if (check !== undefined) {
      const mark = document.createElement('span');
      mark.className = 'menu-check';
      mark.textContent = check ? '✓' : '';
      button.append(mark);
    } else button.append(icon(name));
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
    if (key) {
      const hint = document.createElement('span');
      hint.className = 'menu-key';
      hint.textContent = key;
      button.append(hint);
    }
    button.addEventListener('click', () => { hide(); onClick(); });
    return button;
  }
  const sep = () => Object.assign(document.createElement('div'), { className: 'menu-sep', role: 'separator' });
  const heading = (text) => Object.assign(document.createElement('div'), { className: 'menu-label', textContent: text });

  function build(cellIndex) {
    const state = getState();
    const card = cellIndex === null ? null : state.cards[cellIndex];
    const url = websiteUrl(card?.url);
    const nodes = [];
    if (card) {
      if (url) {
        nodes.push(item('Open', { icon: 'open', key: cellIndex < 9 ? String(cellIndex + 1) : '', onClick: () => window.location.assign(url) }));
        nodes.push(item('Open in new tab', { icon: 'tab', key: cellIndex < 9 ? `Shift+${cellIndex + 1}` : '', onClick: () => window.open(url, '_blank', 'noopener,noreferrer') }));
        nodes.push(item('Copy link', { icon: 'copy', onClick: () => navigator.clipboard?.writeText(url).then(() => notify('Link copied.'), () => notify('Could not copy the link.')) }));
        nodes.push(sep());
      }
      nodes.push(item('Edit shortcut', { icon: 'edit', onClick: () => openShortcut(cellIndex) }));
      nodes.push(item('Remove shortcut', { icon: 'trash', danger: true, onClick: () => removeShortcut(cellIndex) }));
      nodes.push(sep());
    } else if (cellIndex !== null) {
      nodes.push(item('Add shortcut here', { icon: 'add', onClick: () => openShortcut(cellIndex) }));
      nodes.push(sep());
    }
    nodes.push(item(isEditing() ? 'Done editing' : 'Edit mode', { icon: 'edit', onClick: toggleEdit }));
    nodes.push(sep(), heading('View'));
    nodes.push(item('Grid view', { check: state.settings.view === 'grid', onClick: () => setView('grid') }));
    nodes.push(item('List view', { check: state.settings.view === 'list', onClick: () => setView('list') }));
    nodes.push(sep(), heading('Grid size'));
    for (const size of [3, 4, 5]) nodes.push(item(`${size} × ${size}`, { check: state.settings.gridSize === size, onClick: () => setGridSize(size) }));
    nodes.push(sep());
    nodes.push(item('Bookmarks', { icon: 'bookmark', onClick: openBookmarks }));
    nodes.push(item('Tick sound', { check: soundEnabled(), onClick: () => { setSoundEnabled(!soundEnabled()); tick(); } }));
    nodes.push(item('Settings', { icon: 'gear', onClick: openSettings }));
    nodes.push(item('Reload page', { icon: 'reload', key: 'Ctrl+R', onClick: () => window.location.reload() }));
    return nodes;
  }

  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest?.('input, textarea, dialog[open]')) return;
    event.preventDefault();
    const cell = event.target.closest?.('.cell');
    menu.replaceChildren(...build(cell ? Number(cell.dataset.index) : null));
    menu.hidden = false;
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(event.clientX, innerWidth - width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(event.clientY, innerHeight - height - 4))}px`;
    menu.querySelector('.menu-item')?.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', (event) => { if (!menu.hidden && !menu.contains(event.target)) hide(); });
  document.addEventListener('keydown', (event) => {
    if (menu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); hide(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...menu.querySelectorAll('.menu-item')];
      const at = items.indexOf(document.activeElement);
      items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  }, true);
  addEventListener('blur', hide);
  addEventListener('resize', hide);
  addEventListener('scroll', hide, true);
}
