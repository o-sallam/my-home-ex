import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = { globalThis: {}, URL, Date };
vm.runInNewContext(readFileSync(new URL('../public/limits-core.js', import.meta.url), 'utf8'), sandbox);
const L = sandbox.globalThis.LimitsCore;
const at = (h, m = 0, day = 7) => new Date(2026, 10, day, h, m);
const youtube = { label: 'YouTube', url: 'https://www.youtube.com/', limits: { schedule: { enabled: true, start: '18:00', end: '19:00' }, daily: { enabled: true, minutes: 15 } } };

test('rules ignore disabled or invalid restrictions', () => {
  assert.equal(L.ruleFromCard({ url: 'https://a.com', limits: { schedule: { enabled: false, start: '18:00', end: '19:00' } } }), null);
  assert.equal(L.ruleFromCard({ url: 'https://a.com', limits: { schedule: { enabled: true, start: '18:00', end: '18:00' } } }), null);
  assert.equal(L.ruleFromCard({ url: 'javascript:alert(1)', limits: { daily: { enabled: true, minutes: 10 } } }), null);
  assert.equal(L.ruleFromCard({ url: 'https://a.com' }), null);
});

test('schedule and daily limit must both be satisfied', () => {
  const rule = L.ruleFromCard(youtube);
  assert.equal(rule.host, 'youtube.com');
  assert.equal(L.evaluate(rule, 0, at(18, 30)).allowed, true);
  assert.equal(L.evaluate(rule, 0, at(17, 59)).reason, 'schedule');
  assert.equal(L.evaluate(rule, 0, at(19, 0)).reason, 'schedule');
  assert.equal(L.evaluate(rule, 15 * 60, at(18, 30)).reason, 'limit');
  assert.equal(L.evaluate(rule, 15 * 60, at(20, 0)).reason, 'both');
  assert.equal(L.evaluate(rule, 14 * 60 + 59, at(18, 30)).allowed, true);
});

test('next allowed time', () => {
  const rule = L.ruleFromCard(youtube);
  assert.deepEqual(L.evaluate(rule, 0, at(10)).nextAllowed, at(18));
  assert.deepEqual(L.evaluate(rule, 0, at(20)).nextAllowed, at(18, 0, 8));
  assert.deepEqual(L.evaluate(rule, 900, at(18, 30)).nextAllowed, at(18, 0, 8));
});

test('overnight windows, schedule-only and limit-only rules', () => {
  const night = L.ruleFromCard({ url: 'https://a.com', limits: { schedule: { enabled: true, start: '22:00', end: '02:00' } } });
  assert.equal(L.evaluate(night, 0, at(23)).allowed, true);
  assert.equal(L.evaluate(night, 0, at(1)).allowed, true);
  assert.equal(L.evaluate(night, 0, at(12)).allowed, false);
  const limit = L.ruleFromCard({ url: 'https://a.com', limits: { daily: { enabled: true, minutes: 10 } } });
  assert.equal(L.evaluate(limit, 599, at(3)).allowed, true);
  assert.deepEqual(L.evaluate(limit, 600, at(3)).nextAllowed, at(0, 0, 8));
});

test('usage resets with the local day and hosts match subdomains', () => {
  const usage = { day: L.dayKey(at(10)), seconds: { 'youtube.com': 120 } };
  assert.equal(L.usedToday(usage, 'youtube.com', at(23, 59)), 120);
  assert.equal(L.usedToday(usage, 'youtube.com', at(0, 0, 8)), 0);
  const rules = L.deriveRules([youtube]);
  assert.ok(L.matchRule(rules, 'm.youtube.com'));
  assert.ok(L.matchRule(rules, 'www.youtube.com'));
  assert.equal(L.matchRule(rules, 'notyoutube.com'), null);
});

test('every Home website is tracked, and an unrestricted entry never replaces a restricted one', () => {
  const rules = L.deriveRules([{ label: 'Plain', url: 'https://plain.com/' }, { label: 'A', url: 'https://yt.com/' }, youtube, { label: 'Dup', url: 'https://www.youtube.com/watch' }]);
  assert.equal(Object.keys(rules).sort().join(), 'plain.com,youtube.com,yt.com');
  assert.equal(L.evaluate(rules['plain.com'], 99999, at(3)).allowed, true);
  assert.equal(rules['youtube.com'].dailyMinutes, 15);
  assert.equal(L.lastDays(7, at(12)).length, 7);
  assert.equal(L.lastDays(7, at(12))[0].key, L.dayKey(at(12)));
});
