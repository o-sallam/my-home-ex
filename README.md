# Custom Home

A lightweight Chrome new-tab extension built with Vanilla JavaScript, native ES modules and Vite. Rounded dark tiles, local brand icons, configurable 3 × 3 / 4 × 4 / 5 × 5 grids, and no search bar or history access. No backend, framework, runtime dependencies, CDN scripts or external icon requests.

## Develop locally

Use Node.js **22.12 or newer** and npm.

```bash
npm install
npm run dev
```

Open the Local URL printed by Vite (normally `http://127.0.0.1:5173`). All features work in a normal browser. CSS changes update through HMR; HTML and JavaScript changes trigger automatic refresh. Keep the dev server running while editing. Use Vite rather than opening the source HTML as a file.

```bash
npm run build
npm run preview
```

The build produces `dist/`. Preview serves that production build, normally at `http://127.0.0.1:4173`; it does not watch source changes. Rebuild to update preview or the installed extension.

## Load into Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select this project's **dist** folder.
4. Open a new tab. Chrome may ask you to confirm the new-tab override.

Chrome 120 or newer is required. After subsequent builds, reload the extension on `chrome://extensions` and open a fresh new tab. The production build uses Manifest V3, packaged ES modules and a policy that permits only local executable scripts. The only requested permission is `storage`.

### Upgrade an existing installation without losing shortcuts

**Keep the existing extension installed and retain its ID.** Uninstalling an extension clears its saved data. Loading an unpacked extension from a different folder usually gives it a different ID and a separate storage origin.

For the original version loaded from the **repository root**, keep that same path: run `npm install` and `npm run build`, then click **Reload** on the existing extension. The root `manifest.json` is an upgrade entry point that opens `dist/index.html`. The production manifest in `public/` is copied into `dist/` and opens `index.html` for fresh installations. Both manifests must have the same metadata, permissions and policy.

Do not remove the original installation and load `dist/` as a new extension when you need its old data. For a packaged release, update the existing extension using its existing publishing identity.

## Use and customize

- **Settings → Grid size:** switch immediately between Small (9), Medium (16) and Large (25). Shrinking the grid keeps hidden shortcuts saved, in their original positions.
- **Empty cell:** pick one of 20 popular websites to save its name, URL, color and bundled brand icon immediately. Or choose **Custom shortcut** to enter a name and full HTTP(S) address.
- **Custom icons:** upload a PNG, JPG, WebP or GIF up to 2 MB. Images are resized locally to a 128 × 128 PNG and saved with the shortcut. Animated images use one frame. Choose **Use initial instead** for a letter icon with a custom color.
- **Edit shortcuts:** select any tile to edit its name or URL, switch to **Popular websites** to replace it, or choose **Remove shortcut** to leave the cell empty. Brand icons retain their brand colors; letter and legacy icons support custom colors.
- Drag tiles while editing to swap positions, including empty cells. Keyboard users can focus a cell and use **Alt + arrow keys**. Swapping preserves both shortcuts.
- Grid and list view are both available, and the choice is saved. Press **1–9** to open the first nine shortcuts outside editing and dialogs. Links open in the current tab; normal browser link controls still work.
- Dialogs support Escape, backdrop dismissal, keyboard tabs, focus trapping and reduced motion.

## Storage and migration

`src/js/storage.js` provides one asynchronous `get`/`set` interface:

| Environment | Storage |
| --- | --- |
| Installed extension | `chrome.storage.local` |
| Vite development / preview | This browser origin's `localStorage` |

These environments are **separate**. Development and preview also have separate storage because their ports differ. Neither syncs with your Chrome account or sends settings to a server.

The original version stored `home_cards` (a JSON array of `{ icon, label, url, color }`) and `home_view` (a plain `grid` or `list` string) in localStorage. On first use, the new version copies these into `home_state_v2`, which contains `version`, the complete `cards` array (including empty positions), and `settings` (`gridSize`, `view`). Inside the extension it checks Chrome storage first, then the original extension's localStorage. Existing v2 data takes precedence. Legacy keys remain untouched as a recovery copy; migration never clears them. Corrupt data produces a visible error instead of overwriting it with defaults.

The default nine destinations remain available on a fresh install, including Khamsat, Image Resizer, Claude, Gemini and the temporary-chat ChatGPT URL. All icons offered by the original picker are bundled for legacy compatibility. Unknown manually typed icon classes display the shortcut's initial; their saved values are retained. Legacy unsafe URLs remain saved but cannot navigate until edited to HTTP(S). Names are rendered as text, never HTML. SVG uploads are not accepted.

Storage writes finish before the UI changes. If browser storage is full or unavailable, the existing configuration stays visible and the app reports that the save failed.

## Project structure

```text
├── index.html                 # Semantic page structure and native dialogs
├── manifest.json              # Upgrade entry for original root installations
├── package.json
├── package-lock.json
├── vite.config.js             # Relative production paths, Chrome target
├── playwright.config.js
├── public/
│   ├── manifest.json           # Production Manifest V3
│   └── assets/
│       ├── home.svg
│       ├── icons/             # Catalog and legacy SVG icons
│       └── licenses/
├── src/
│   ├── css/
│   │   ├── tokens.css
│   │   ├── style.css
│   │   └── animations.css
│   └── js/
│       ├── main.js            # Startup, state commits, keyboard navigation
│       ├── grid.js            # Tiles, view rendering and reordering
│       ├── settings.js        # Persistent grid selector
│       ├── shortcuts.js       # Catalog and custom shortcut editor
│       ├── catalog.js         # Website definitions and original defaults
│       ├── storage.js         # Storage adapter and legacy migration
│       ├── urls.js            # Safe navigation boundaries
│       ├── icons.js           # Safe images and legacy/brand rendering
│       ├── icon-files.json    # Bundled icon lookup
│       └── dialogs.js         # Shared native-dialog behavior
├── tests/
│   ├── storage.test.js
│   ├── build.test.js
│   └── browser/home.spec.js
└── dist/                      # Generated extension (not committed)
```

## Verification

```bash
npm test                       # Builds, then runs migration/security/asset checks
npx playwright install chromium
npm run test:e2e               # Starts Vite and runs Chromium interaction checks
```

To use an already installed compatible Chromium instead of downloading one, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path when running `npm run test:e2e`.

The browser suite covers grid persistence, hidden cells, catalog icons, custom image uploads, editing/replacing/removing, original-data migration, list view, drag and keyboard reordering, URL safety, failed saves, number keys, small windows and reduced motion. Browser tests require permission to launch Chromium and listen on localhost. Installed-extension behavior and live reload should also be checked manually in Chrome after loading/reloading the extension.

During implementation, the restricted execution sandbox blocked localhost listening and Chromium's required sockets. Consequently automated browser, visual, HMR and installed-extension checks could not be completed there; the build and Node checks can run without these capabilities.

## Icon credits

Locally bundled SVGs are drawn from **Simple Icons 16.36.0** (CC0) and **Font Awesome Free 7.3.1** (icons under CC BY 4.0), with Google, Gmail and Drive composed in their multicolor treatments. The corresponding license texts are bundled in `public/assets/licenses/` and included in the build. Only the used catalog icons and the original picker's icons are shipped; no icon package is loaded at runtime. Brand marks belong to their respective owners.

Build and extension policy references: [Vite production builds](https://vite.dev/guide/build), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), and [Manifest V3 content security policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).
