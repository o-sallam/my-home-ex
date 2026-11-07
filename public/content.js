// Enforces per-site schedules and daily limits inside every page. The page stays
// hidden until the rule check finishes, and it is replaced by the block page the
// moment a restriction applies (including in tabs that were already open).
(() => {
  const L = globalThis.LimitsCore;
  if (!L || !chrome?.runtime?.id) return;

  const cover = document.createElement('style');
  cover.textContent = 'html{visibility:hidden!important}';
  (document.head || document.documentElement).append(cover);
  const reveal = () => cover.remove();

  let rules = {};
  let usage = { day: '', seconds: {} };
  let rule = null;
  let pending = 0;
  let sinceFlush = 0;
  let timer = null;
  let blocked = false;

  const alive = () => { try { return Boolean(chrome.runtime.id); } catch { return false; } };

  function normalize(value, now) {
    return value && value.day === L.dayKey(now) ? value : { day: L.dayKey(now), seconds: {} };
  }

  async function flush() {
    if (!pending || !rule || !alive()) return;
    const seconds = pending;
    pending = 0;
    sinceFlush = 0;
    try {
      const now = new Date();
      const stored = await chrome.storage.local.get([L.USAGE_KEY, L.HISTORY_KEY]);
      const next = normalize(stored[L.USAGE_KEY], now);
      next.seconds[rule.host] = (Number(next.seconds[rule.host]) || 0) + seconds;
      usage = next;
      // Daily totals per website, kept for about five weeks for the usage overview.
      const history = stored[L.HISTORY_KEY] || {};
      const today = history[next.day] || (history[next.day] = {});
      today[rule.host] = (Number(today[rule.host]) || 0) + seconds;
      const keep = new Set(L.lastDays(L.HISTORY_DAYS, now).map((d) => d.key));
      for (const day of Object.keys(history)) if (!keep.has(day)) delete history[day];
      await chrome.storage.local.set({ [L.USAGE_KEY]: next, [L.HISTORY_KEY]: history });
    } catch { /* extension reloaded or storage unavailable */ }
  }

  function block() {
    if (blocked) return;
    blocked = true;
    clearInterval(timer);
    flush();
    const page = `${chrome.runtime.getURL(chrome.runtime.getManifest().web_accessible_resources[0].resources[0])}?host=${encodeURIComponent(rule.host)}&u=${encodeURIComponent(location.href)}`;
    location.replace(page);
  }

  function used(now) { return L.usedToday(usage, rule.host, now) + pending; }

  // Only time the site is actually in front of the user counts.
  const active = () => document.visibilityState === 'visible' && document.hasFocus();

  function tick() {
    if (!alive()) { clearInterval(timer); return; }
    const now = new Date();
    if (active()) { pending += 1; sinceFlush += 1; }
    if (!L.evaluate(rule, used(now), now).allowed) { block(); return; }
    if (sinceFlush >= 5) flush();
  }

  function apply() {
    if (blocked) return;
    const next = L.matchRule(rules, location.hostname);
    if (next?.host !== rule?.host) { flush(); }
    rule = next;
    clearInterval(timer);
    if (!rule) { reveal(); return; }
    const now = new Date();
    if (!L.evaluate(rule, used(now), now).allowed) { block(); return; }
    reveal();
    timer = setInterval(tick, 1000);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || blocked) return;
    if (changes[L.RULES_KEY]) rules = changes[L.RULES_KEY].newValue || {};
    if (changes[L.USAGE_KEY]) usage = normalize(changes[L.USAGE_KEY].newValue, new Date());
    if (changes[L.RULES_KEY] || changes[L.USAGE_KEY]) apply();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); else if (rule) tick(); });
  addEventListener('pagehide', flush);
  addEventListener('blur', flush);

  chrome.storage.local.get([L.RULES_KEY, L.USAGE_KEY]).then((data) => {
    rules = data[L.RULES_KEY] || {};
    usage = normalize(data[L.USAGE_KEY], new Date());
    apply();
  }, reveal);
  // Never leave a page blank if storage never answers.
  setTimeout(reveal, 1500);
})();
