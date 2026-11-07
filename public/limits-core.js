// Shared scheduling / daily-limit logic. A classic script (no modules) so the Home page,
// the content script and the block page all run the exact same rules.
(function (root) {
  const RULES_KEY = 'site_rules_v1';
  const USAGE_KEY = 'site_usage_v1';
  const MINUTE = 60000;

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

  function parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ''));
    if (!match) return null;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    return Number(match[1]) < 24 && Number(match[2]) < 60 ? minutes : null;
  }

  function ruleHost(hostname) { return String(hostname || '').toLowerCase().replace(/^www\./, ''); }

  function hostOfUrl(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) ? ruleHost(parsed.hostname) : null;
    } catch { return null; }
  }

  // The rule saved on a card -> the compact rule used for enforcement (or null).
  function ruleFromCard(card) {
    const host = hostOfUrl(card?.url);
    const limits = card?.limits;
    if (!host || !limits) return null;
    const start = parseTime(limits.schedule?.start);
    const end = parseTime(limits.schedule?.end);
    const schedule = limits.schedule?.enabled && start !== null && end !== null && start !== end
      ? { start, end } : null;
    const minutes = Number(limits.daily?.minutes);
    const dailyMinutes = limits.daily?.enabled && Number.isFinite(minutes) && minutes >= 1 ? Math.min(1440, Math.round(minutes)) : null;
    if (!schedule && dailyMinutes === null) return null;
    return { host, name: String(card.label || host), schedule, dailyMinutes };
  }

  function deriveRules(cards) {
    const rules = {};
    for (const card of cards || []) {
      const rule = ruleFromCard(card);
      if (rule) rules[rule.host] = rule;
    }
    return rules;
  }

  // Exact host or any subdomain of a ruled host. The longest (most specific) host wins.
  function matchRule(rules, hostname) {
    const host = ruleHost(hostname);
    let best = null;
    for (const key of Object.keys(rules || {})) {
      if ((host === key || host.endsWith(`.${key}`)) && (!best || key.length > best.length)) best = key;
    }
    return best ? rules[best] : null;
  }

  function inWindow(schedule, minutes) {
    return schedule.start < schedule.end
      ? minutes >= schedule.start && minutes < schedule.end
      : minutes >= schedule.start || minutes < schedule.end;
  }

  function atMinutes(date, minutes) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    result.setMinutes(minutes);
    return result;
  }

  function nextStart(schedule, now) {
    const today = atMinutes(now, schedule.start);
    if (today > now) return today;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return atMinutes(tomorrow, schedule.start);
  }

  function usedToday(usage, host, now) {
    return usage && usage.day === dayKey(now) ? Number(usage.seconds?.[host]) || 0 : 0;
  }

  // Every enabled restriction must be satisfied for the site to be allowed.
  function evaluate(rule, usedSeconds, now = new Date()) {
    const scheduleBlocked = Boolean(rule.schedule) && !inWindow(rule.schedule, minutesOfDay(now));
    const limitSeconds = rule.dailyMinutes === null ? null : rule.dailyMinutes * 60;
    const limitReached = limitSeconds !== null && usedSeconds >= limitSeconds;
    let nextAllowed = null;
    if (limitReached) {
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      nextAllowed = rule.schedule && !inWindow(rule.schedule, 0) ? atMinutes(midnight, rule.schedule.start) : midnight;
    } else if (scheduleBlocked) {
      nextAllowed = nextStart(rule.schedule, now);
    }
    // Seconds of use left today, also capped by when the allowed window closes.
    let remainingSeconds = limitSeconds === null ? null : Math.max(0, limitSeconds - usedSeconds);
    return {
      allowed: !scheduleBlocked && !limitReached,
      scheduleBlocked,
      limitReached,
      reason: scheduleBlocked && limitReached ? 'both' : scheduleBlocked ? 'schedule' : limitReached ? 'limit' : null,
      nextAllowed,
      remainingSeconds,
      usedSeconds,
    };
  }

  const REASONS = {
    schedule: 'Outside allowed schedule.',
    limit: 'Daily usage limit reached.',
    both: 'Both restrictions apply: outside the allowed schedule and the daily usage limit is reached.',
  };

  function formatClock(minutes) {
    const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function formatWhen(date, now = new Date()) {
    if (!date) return '';
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (dayKey(date) === dayKey(now)) return `today at ${time}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dayKey(date) === dayKey(tomorrow) ? `tomorrow at ${time}` : `${date.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);
    if (minutes >= 60) return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
    if (minutes >= 1) return `${minutes} min`;
    return `${total} s`;
  }

  function describe(rule) {
    const parts = [];
    if (rule.schedule) parts.push(`${formatClock(rule.schedule.start)} – ${formatClock(rule.schedule.end)}`);
    if (rule.dailyMinutes !== null) parts.push(`${rule.dailyMinutes} min/day`);
    return parts.join(' · ');
  }

  root.LimitsCore = {
    RULES_KEY, USAGE_KEY, MINUTE, dayKey, parseTime, ruleHost, hostOfUrl, ruleFromCard, deriveRules,
    matchRule, inWindow, usedToday, evaluate, REASONS, formatClock, formatWhen, formatDuration, describe,
  };
})(globalThis);
