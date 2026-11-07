import { setupDialog } from './dialogs.js';
import { hostname } from './urls.js';

export function setupUsageModal({ storage, getState }) {
  const L = globalThis.LimitsCore;
  const button = document.querySelector('#usage-open');
  const dialogEl = document.querySelector('#usage-dialog');
  const dialog = setupDialog(dialogEl);
  const tabs = [...dialogEl.querySelectorAll('.usage-tab')];
  const list = document.querySelector('#usage-list');
  const total = document.querySelector('#usage-total');
  const caption = document.querySelector('#usage-caption');
  const chart = document.querySelector('#usage-chart');
  let period = 'day';
  let history = {};

  const sum = (days, host) => days.reduce((seconds, day) => seconds + (Number(history[day.key]?.[host]) || 0), 0);

  function sites() {
    const byHost = new Map();
    for (const card of getState().cards) {
      const host = card && L.hostOfUrl(card.url);
      if (host && !byHost.has(host)) byHost.set(host, { host, name: String(card.label || host), card });
    }
    return [...byHost.values()];
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render() {
    const now = new Date();
    const days = L.lastDays(period === 'day' ? 1 : 7, now);
    const rows = sites().map((site) => ({ ...site, seconds: sum(days, site.host) })).sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
    const max = Math.max(1, ...rows.map((row) => row.seconds));
    const grand = rows.reduce((seconds, row) => seconds + row.seconds, 0);
    total.textContent = L.formatDuration(grand);
    caption.textContent = period === 'day' ? 'total today' : `total · ${L.formatDuration(grand / 7)} per day`;

    // Seven small columns: total per day, oldest on the left.
    const week = L.lastDays(7, now).reverse().map((day) => ({ ...day, seconds: rows.reduce((s, r) => s + (Number(history[day.key]?.[r.host]) || 0), 0) }));
    const peak = Math.max(1, ...week.map((day) => day.seconds));
    chart.replaceChildren(...week.map((day, i) => {
      const column = el('div', `usage-col${i === 6 ? ' is-today' : ''}`);
      column.title = `${day.date.toLocaleDateString([], { weekday: 'long' })}: ${L.formatDuration(day.seconds)}`;
      const bar = el('span', 'usage-col-bar');
      bar.style.height = `${Math.max(day.seconds ? 8 : 3, Math.round((day.seconds / peak) * 100))}%`;
      column.append(bar, el('span', 'usage-col-label', day.date.toLocaleDateString([], { weekday: 'narrow' })));
      return column;
    }));

    if (!rows.length) { list.replaceChildren(el('p', 'bm-empty', 'Add websites to your Home page to see their usage.')); return; }
    list.replaceChildren(...rows.map((row) => {
      const item = el('div', 'usage-row');
      const info = el('div', 'usage-info');
      info.append(el('span', 'usage-name', row.name), el('span', 'usage-host', hostname(row.card.url)));
      const meter = el('div', 'usage-meter');
      const fill = el('span', 'usage-fill');
      fill.style.width = `${Math.round((row.seconds / max) * 100)}%`;
      meter.append(fill);
      const figures = el('div', 'usage-figures');
      figures.append(el('strong', row.seconds ? '' : 'is-zero', row.seconds ? L.formatDuration(row.seconds) : '—'));
      const rule = L.ruleFromCard(row.card);
      if (rule?.dailyMinutes !== null && rule) {
        const left = Math.max(0, rule.dailyMinutes * 60 - sum(L.lastDays(1, now), row.host));
        figures.append(el('span', '', `${L.formatDuration(left)} left today`));
      } else if (period === 'week' && row.seconds) figures.append(el('span', '', `${L.formatDuration(row.seconds / 7)} / day`));
      item.append(info, meter, figures);
      return item;
    }));
  }

  async function load() {
    try { history = (await storage.get(L.HISTORY_KEY)) || {}; } catch { history = {}; }
    render();
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    period = tab.id === 'usage-week' ? 'week' : 'day';
    tabs.forEach((other) => other.setAttribute('aria-selected', other === tab));
    render();
  }));
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[L.HISTORY_KEY] || !dialogEl.open) return;
      history = changes[L.HISTORY_KEY].newValue || {};
      render();
    });
  }

  async function open() {
    await load();
    dialog.open();
  }
  button.addEventListener('click', open);
  return { open };
}
