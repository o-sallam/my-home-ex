(() => {
  const L = globalThis.LimitsCore;
  const params = new URLSearchParams(location.search);
  const host = L.ruleHost(params.get('host'));
  const original = L.hostOfUrl(params.get('u')) ? params.get('u') : null;
  const reason = document.querySelector('#reason');
  const facts = document.querySelector('#facts');
  document.querySelector('#site').textContent = host;
  let rules = {};
  let usage = null;

  function row(label, value, className = '') {
    const wrap = document.createElement('div');
    if (className) wrap.className = className;
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    wrap.append(dt, dd);
    return wrap;
  }

  function render() {
    const rule = L.matchRule(rules, host);
    const now = new Date();
    if (!rule) { if (original) location.replace(original); return; }
    const result = L.evaluate(rule, L.usedToday(usage, rule.host, now), now);
    if (result.allowed) { if (original) location.replace(original); else reason.textContent = 'This website is allowed again.'; return; }
    reason.textContent = L.REASONS[result.reason];
    const rows = [];
    if (rule.schedule) rows.push(row('Allowed hours', `${L.formatClock(rule.schedule.start)} – ${L.formatClock(rule.schedule.end)}`));
    if (rule.dailyMinutes !== null) {
      rows.push(row('Daily limit', `${rule.dailyMinutes} min`));
      rows.push(row('Used today', L.formatDuration(result.usedSeconds)));
    }
    if (result.nextAllowed) rows.push(row('Next allowed', L.formatWhen(result.nextAllowed, now), 'next'));
    facts.replaceChildren(...rows);
  }

  chrome.storage.local.get([L.RULES_KEY, L.USAGE_KEY]).then((data) => {
    rules = data[L.RULES_KEY] || {};
    usage = data[L.USAGE_KEY] || null;
    render();
    setInterval(render, 1000);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[L.RULES_KEY]) rules = changes[L.RULES_KEY].newValue || {};
    if (changes[L.USAGE_KEY]) usage = changes[L.USAGE_KEY].newValue || null;
    render();
  });
})();
