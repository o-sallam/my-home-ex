import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { CATALOG } from '../src/js/catalog.js';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('catalog has bundled, script-free icons and safe website URLs for every brand', async () => {
  const icons = await json('../src/js/icon-files.json');
  const required = ['WhatsApp', 'Telegram', 'Facebook', 'ChatGPT', 'YouTube', 'Gmail', 'Google', 'Google Drive', 'Instagram', 'X (Twitter)', 'GitHub', 'LinkedIn', 'Reddit', 'Discord', 'TikTok', 'Spotify', 'Netflix', 'Notion'];
  for (const name of required) assert.ok(CATALOG.some((card) => card.label === name), name);
  for (const card of CATALOG) {
    assert.match(card.url, /^https:\/\//);
    assert.match(card.color, /^#[\da-f]{6}$/i);
    const svg = await readFile(new URL(`../public/assets/icons/${icons[card.icon]}`, import.meta.url), 'utf8');
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<script|onload=|<foreignObject|https?:\/\/(?!www.w3.org)/i);
  }
});

test('all legacy icon mappings resolve to local SVGs', async () => {
  const icons = await json('../src/js/icon-files.json');
  for (const file of Object.values(icons)) await access(new URL(`../public/assets/icons/${file}`, import.meta.url));
  for (const icon of ['fas fa-robot', 'fas fa-message', 'fas fa-crop-simple', 'fab fa-discord', 'fab fa-invision']) assert.ok(icons[icon], icon);
});

test('production and upgrade manifests agree except for the page location', async () => {
  const root = await json('../manifest.json');
  const production = await json('../public/manifest.json');
  assert.equal(root.chrome_url_overrides.newtab, 'dist/index.html');
  assert.equal(production.chrome_url_overrides.newtab, 'index.html');
  delete root.chrome_url_overrides;
  delete production.chrome_url_overrides;
  // The root manifest loads the built files from dist/, the production one sits inside it.
  const unprefixed = JSON.parse(JSON.stringify(root).replaceAll('"dist/', '"'));
  assert.deepEqual(unprefixed, production);
  assert.deepEqual(root.permissions, ['storage', 'offscreen', 'bookmarks', 'favicon']);
  for (const file of [root.background.service_worker, ...root.content_scripts[0].js, ...Object.values(root.icons)]) {
    await access(new URL(`../${file}`, import.meta.url));
  }
  assert.equal(root.manifest_version, 3);
  assert.doesNotMatch(root.content_security_policy.extension_pages, /unsafe-eval|unsafe-inline/);
});

test('source HTML contains only local, external scripts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /on(?:click|load|error)=|https:\/\/cdnjs|history-panel|search-wrapper|name="q"/i);
  assert.deepEqual([...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]), ['<script src="/limits-core.js">', '<script type="module" src="/src/js/main.js">']);
});

test('dist contains the MV3 entry point, relative assets, licenses and no inline scripts', async () => {
  const manifest = await json('../dist/manifest.json');
  const html = await readFile(new URL(`../dist/${manifest.chrome_url_overrides.newtab}`, import.meta.url), 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await access(new URL(`../dist/${asset}`, import.meta.url));
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/);
  assert.doesNotMatch(html, /\/src\/|@vite|localhost|cdnjs/);
  const assets = await readdir(new URL('../dist/assets/', import.meta.url));
  assert.ok(assets.some((name) => name.endsWith('.js')));
  assert.ok(assets.some((name) => name.endsWith('.css')));
  await access(new URL('../dist/assets/licenses/simple-icons.txt', import.meta.url));
  await access(new URL('../dist/assets/licenses/font-awesome.txt', import.meta.url));
});
