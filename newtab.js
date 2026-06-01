const ICON_LIST = [
  // Brands
  'fab fa-discord','fab fa-whatsapp','fab fa-youtube','fab fa-google',
  'fab fa-github','fab fa-gitlab','fab fa-reddit-alien','fab fa-twitter',
  'fab fa-x-twitter','fab fa-facebook','fab fa-instagram','fab fa-linkedin',
  'fab fa-tiktok','fab fa-twitch','fab fa-spotify','fab fa-telegram',
  'fab fa-pinterest','fab fa-snapchat','fab fa-slack','fab fa-paypal',
  'fab fa-apple','fab fa-amazon','fab fa-microsoft','fab fa-chrome',
  'fab fa-firefox','fab fa-steam','fab fa-npm','fab fa-docker',
  'fab fa-figma','fab fa-bitcoin','fab fa-dropbox','fab fa-trello',
  'fab fa-notion','fab fa-invision',
  // Solid — general
  'fas fa-robot','fas fa-store','fas fa-gem','fas fa-crop-simple',
  'fas fa-house','fas fa-gear','fas fa-star','fas fa-heart',
  'fas fa-envelope','fas fa-phone','fas fa-camera','fas fa-music',
  'fas fa-video','fas fa-gamepad','fas fa-code','fas fa-terminal',
  'fas fa-database','fas fa-cloud','fas fa-book','fas fa-briefcase',
  'fas fa-cart-shopping','fas fa-location-dot','fas fa-magnifying-glass',
  'fas fa-bell','fas fa-calendar','fas fa-clock','fas fa-chart-bar',
  'fas fa-file','fas fa-folder','fas fa-palette','fas fa-pen',
  'fas fa-trash','fas fa-download','fas fa-upload','fas fa-link',
  'fas fa-shield','fas fa-lock','fas fa-user','fas fa-users',
  'fas fa-dollar-sign','fas fa-globe','fas fa-wifi','fas fa-headphones',
  'fas fa-microphone','fas fa-keyboard','fas fa-laptop','fas fa-mobile-screen',
  'fas fa-tv','fas fa-plug','fas fa-bolt','fas fa-fire',
  'fas fa-flag','fas fa-map','fas fa-newspaper','fas fa-image',
  'fas fa-film','fas fa-podcast','fas fa-rss','fas fa-bug',
];

const DEFAULTS = [
  { icon: 'fab fa-discord',      label: 'Discord',       url: 'https://discord.com/app',                  color: '#5865f2' },
  { icon: 'fab fa-whatsapp',     label: 'WhatsApp',      url: 'https://web.whatsapp.com',                 color: '#25d366' },
  { icon: 'fab fa-youtube',      label: 'YouTube',       url: 'https://youtube.com',                      color: '#ff0000' },
  { icon: 'fas fa-robot',        label: 'ChatGPT',       url: 'https://chatgpt.com/?temporary-chat=true', color: '#10a37f' },
  { icon: 'fab fa-github',       label: 'GitHub',        url: 'https://github.com',                       color: '#e6edf3' },
  { icon: 'fas fa-store',        label: 'Khamsat',       url: 'https://khamsat.com',                      color: '#f5a623' },
  { icon: 'fas fa-message',      label: 'Claude',        url: 'https://claude.ai/new',                    color: '#d97757' },
  { icon: 'fas fa-crop-simple',  label: 'Image Resizer', url: 'https://imageresizer.com/',                color: '#00b4d8' },
  { icon: 'fas fa-gem',          label: 'Gemini',        url: 'https://gemini.google.com',                color: '#8ab4f8' },
];

const STORAGE_KEY = 'home_cards';

function loadCards() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULTS;
  } catch { return DEFAULTS; }
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

let cards = loadCards();
let editMode = false;
let editingIndex = null;
let viewMode = localStorage.getItem('home_view') || 'grid';
let dragIndex = null;

const grid       = document.getElementById('grid');
const overlay    = document.getElementById('modalOverlay');
const inputIcon  = document.getElementById('inputIcon');
const inputColor = document.getElementById('inputColor');
const inputTitle = document.getElementById('inputTitle');
const inputUrl   = document.getElementById('inputUrl');
const preview    = document.getElementById('previewIcon');
const iconPicker = document.getElementById('iconPicker');

// Build the picker once
ICON_LIST.forEach((cls) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = cls;
  btn.innerHTML = '<i class="' + cls + '"></i>';
  btn.addEventListener('click', () => {
    inputIcon.value = cls;
    updatePreview();
    highlightPicker(cls);
  });
  iconPicker.appendChild(btn);
});

function highlightPicker(cls) {
  iconPicker.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('selected', btn.title === cls);
  });
}

function renderCards() {
  grid.innerHTML = '';
  grid.classList.toggle('list-view', viewMode === 'list');

  cards.forEach((card, i) => {
    let hostname = '';
    try { hostname = new URL(card.url).hostname.replace(/^www\./, ''); } catch {}

    const el = document.createElement('a');
    el.className = 'card';
    el.href = card.url;
    el.draggable = true;
    el.innerHTML =
      '<i class="card-icon ' + card.icon + '" style="color:' + card.color + '"></i>' +
      '<span class="card-label">' + card.label + '</span>' +
      '<span class="card-url">' + hostname + '</span>' +
      '<div class="edit-hint"><i class="fas fa-pen"></i></div>';

    el.addEventListener('click', (e) => {
      if (editMode) {
        e.preventDefault();
        openModal(i);
      }
    });

    // ── Drag to reorder ──
    el.addEventListener('dragstart', (e) => {
      if (!editMode) { e.preventDefault(); return; }
      dragIndex = i;
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      grid.querySelectorAll('.card').forEach((c) => c.classList.remove('drag-over'));
      dragIndex = null;
    });
    el.addEventListener('dragover', (e) => {
      if (!editMode || dragIndex === null || dragIndex === i) return;
      e.preventDefault();
      grid.querySelectorAll('.card').forEach((c) => c.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });
    el.addEventListener('drop', (e) => {
      if (!editMode || dragIndex === null || dragIndex === i) return;
      e.preventDefault();
      const moved = cards.splice(dragIndex, 1)[0];
      cards.splice(i, 0, moved);
      saveCards(cards);
      renderCards();
    });

    grid.appendChild(el);
  });
}

// ── View toggle ──
function setView(mode) {
  viewMode = mode;
  localStorage.setItem('home_view', mode);
  document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('viewList').classList.toggle('active', mode === 'list');
  renderCards();
}

document.getElementById('viewGrid').addEventListener('click', () => setView('grid'));
document.getElementById('viewList').addEventListener('click', () => setView('list'));

document.getElementById('editToggle').addEventListener('click', () => {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
});

function openModal(index) {
  editingIndex = index;
  const c = cards[index];
  inputIcon.value  = c.icon;
  inputColor.value = c.color;
  inputTitle.value = c.label;
  inputUrl.value   = c.url;
  updatePreview();
  highlightPicker(c.icon);
  overlay.classList.add('open');
  inputIcon.focus();
}

function closeModal() {
  overlay.classList.remove('open');
  editingIndex = null;
}

function updatePreview() {
  preview.className  = inputIcon.value.trim() || 'fas fa-question';
  preview.style.color = inputColor.value;
}

inputIcon.addEventListener('input', () => { updatePreview(); highlightPicker(inputIcon.value.trim()); });
inputColor.addEventListener('input', updatePreview);

document.getElementById('btnCancel').addEventListener('click', closeModal);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

document.getElementById('btnSave').addEventListener('click', () => {
  if (editingIndex === null) return;
  cards[editingIndex] = {
    icon:  inputIcon.value.trim()  || cards[editingIndex].icon,
    color: inputColor.value,
    label: inputTitle.value.trim() || cards[editingIndex].label,
    url:   inputUrl.value.trim()   || cards[editingIndex].url,
  };
  saveCards(cards);
  renderCards();
  closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  
  // Keyboard shortcuts 1-9 to open cards
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9 && cards[num - 1] && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    window.location.href = cards[num - 1].url;
  }
});

setView(viewMode);
loadHistory();
setTimeout(() => document.querySelector('input[name="q"]').focus(), 50);

// ── History ──
const selectedUrls = new Set();
const openSelectedBtn   = document.getElementById('openSelected');
const openSelectedLabel = document.getElementById('openSelectedLabel');

function updateOpenButton() {
  const count = selectedUrls.size;
  if (count > 0) {
    openSelectedBtn.classList.add('visible');
    openSelectedLabel.textContent = 'Open ' + count + ' tab' + (count > 1 ? 's' : '');
  } else {
    openSelectedBtn.classList.remove('visible');
  }
}

openSelectedBtn.addEventListener('click', () => {
  selectedUrls.forEach((url) => window.open(url, '_blank'));
  // clear selection after opening
  selectedUrls.clear();
  document.querySelectorAll('.history-item.selected').forEach((el) => el.classList.remove('selected'));
  updateOpenButton();
});

// Escape clears selection
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    selectedUrls.clear();
    document.querySelectorAll('.history-item.selected').forEach((el) => el.classList.remove('selected'));
    updateOpenButton();
  }
});

function loadHistory() {
  const list = document.getElementById('historyList');

  if (!chrome || !chrome.history) {
    list.innerHTML = '<p class="history-empty">History unavailable.</p>';
    return;
  }

  chrome.history.search({ text: '', maxResults: 30, startTime: 0 }, (items) => {
    if (!items || items.length === 0) {
      list.innerHTML = '<p class="history-empty">No history found.</p>';
      return;
    }

    // deduplicate by hostname+path, keep most recent visit
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      try {
        const key = new URL(item.url).hostname + new URL(item.url).pathname;
        if (!seen.has(key)) { seen.add(key); unique.push(item); }
      } catch { /* skip malformed URLs */ }
    }

    list.innerHTML = '';
    unique.forEach((item) => {
      let hostname = '';
      try { hostname = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}

      const faviconUrl = 'https://www.google.com/s2/favicons?sz=16&domain_url=' + encodeURIComponent(item.url);

      const a = document.createElement('a');
      a.className = 'history-item';
      a.href = item.url;
      a.title = item.url;
      a.innerHTML =
        '<img src="' + faviconUrl + '" alt="">' +
        '<div class="item-info">' +
          '<span class="item-title">' + (item.title || hostname || item.url) + '</span>' +
          '<span class="item-domain">' + hostname + '</span>' +
        '</div>';

      a.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (selectedUrls.has(item.url)) {
            selectedUrls.delete(item.url);
            a.classList.remove('selected');
          } else {
            selectedUrls.add(item.url);
            a.classList.add('selected');
          }
          updateOpenButton();
        } else {
          // normal click: clear any selection and navigate
          selectedUrls.clear();
          document.querySelectorAll('.history-item.selected').forEach((el) => el.classList.remove('selected'));
          updateOpenButton();
          window.location.href = item.url;
        }
      });

      list.appendChild(a);
    });
  });
}
