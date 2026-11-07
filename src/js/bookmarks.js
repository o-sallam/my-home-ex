import { setupDialog } from './dialogs.js';
import { websiteUrl, hostname } from './urls.js';

const api = typeof chrome !== 'undefined' ? chrome.bookmarks : undefined;

// Flatten the bookmark tree into folders that directly hold links.
function collect(nodes, path, groups) {
  const items = [];
  for (const node of nodes) {
    if (node.url) {
      const url = websiteUrl(node.url);
      if (url) items.push({ title: node.title || hostname(url) || url, url });
    } else if (node.children) {
      collect(node.children, node.title ? [...path, node.title] : path, groups);
    }
  }
  if (items.length) groups.unshift({ name: path.join(' › ') || 'Bookmarks', items });
}

function favicon(url) {
  const img = document.createElement('img');
  img.className = 'bm-favicon';
  img.alt = '';
  img.width = img.height = 16;
  img.loading = 'lazy';
  img.src = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=32`;
  return img;
}

export function setupBookmarks({ notify }) {
  const button = document.querySelector('#bookmarks-open');
  button.hidden = false;
  if (!api) {
    const explain = () => notify('Bookmarks access is missing. Reload the extension at brave://extensions (or chrome://extensions) and accept its new permissions.');
    button.addEventListener('click', explain);
    return { open: explain };
  }
  const dialog = setupDialog(document.querySelector('#bookmarks-dialog'));
  const list = document.querySelector('#bookmarks-list');
  const search = document.querySelector('#bookmarks-search');
  const count = document.querySelector('#bookmarks-count');
  let groups = [];

  function render() {
    const query = search.value.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    let total = 0;
    for (const group of groups) {
      const items = query ? group.items.filter((i) => i.title.toLowerCase().includes(query) || i.url.toLowerCase().includes(query)) : group.items;
      if (!items.length) continue;
      total += items.length;
      const section = document.createElement('section');
      section.className = 'bm-group';
      const heading = document.createElement('h3');
      heading.textContent = group.name;
      const number = document.createElement('span');
      number.textContent = items.length;
      heading.append(number);
      section.append(heading);
      for (const item of items) {
        const link = document.createElement('a');
        link.className = 'bm-item';
        link.href = item.url;
        link.rel = 'noopener noreferrer';
        link.title = item.url;
        const name = document.createElement('span');
        name.className = 'bm-title';
        name.textContent = item.title;
        const domain = document.createElement('span');
        domain.className = 'bm-domain';
        domain.textContent = hostname(item.url);
        link.append(favicon(item.url), name, domain);
        section.append(link);
      }
      fragment.append(section);
    }
    if (!total) {
      const empty = document.createElement('p');
      empty.className = 'bm-empty';
      empty.textContent = query ? 'No bookmarks match your search.' : 'No bookmarks yet.';
      fragment.append(empty);
    }
    list.replaceChildren(fragment);
    count.textContent = total ? String(total) : '';
  }

  async function open() {
    try {
      groups = [];
      collect(await api.getTree(), [], groups);
    } catch {
      notify('Bookmarks could not be loaded.');
      return;
    }
    search.value = '';
    render();
    list.scrollTop = 0;
    dialog.open();
    search.focus();
  }

  button.addEventListener('click', open);
  search.addEventListener('input', render);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') list.querySelector('.bm-item')?.click();
    if (event.key === 'ArrowDown') { event.preventDefault(); list.querySelector('.bm-item')?.focus(); }
  });
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...list.querySelectorAll('.bm-item')];
    const next = items[items.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) next.focus(); else if (event.key === 'ArrowUp') search.focus();
  });
  return { open };
}
