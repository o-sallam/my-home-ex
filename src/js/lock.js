import { setupDialog } from './dialogs.js';

// Password gate for changing website schedules and limits. Only the salted PBKDF2
// hash is stored. It is active in the installed extension (not in the web preview).
const KEY = 'lock_v1';
const ITERATIONS = 200_000;
const UNLOCK_MS = 2 * 60 * 1000;

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function derive(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256));
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function setupLock({ storage }) {
  const enabled = storage.mode === 'extension' && Boolean(globalThis.crypto?.subtle);
  let record;
  let unlockedUntil = 0;
  let failures = 0;
  let waitUntil = 0;

  const setup = document.querySelector('#lock-setup');
  const setupForm = document.querySelector('#lock-setup-form');
  const setupError = document.querySelector('#lock-setup-error');
  const prompt = document.querySelector('#lock-prompt');
  const promptForm = document.querySelector('#lock-prompt-form');
  const promptError = document.querySelector('#lock-prompt-error');
  const promptDialog = setupDialog(prompt);
  let setupCancelable = false;

  setup.addEventListener('cancel', (event) => { event.preventDefault(); if (setupCancelable) setup.close(); });
  document.querySelector('#lock-setup-cancel').addEventListener('click', () => setup.close());

  async function load() { if (record === undefined) record = (await storage.get(KEY)) || null; return record; }

  function showSetup({ title, intro, cancelable }) {
    setupCancelable = cancelable;
    document.querySelector('#lock-setup-title').textContent = title;
    document.querySelector('#lock-setup-intro').textContent = intro;
    document.querySelector('#lock-setup-cancel').hidden = !cancelable;
    setupForm.reset();
    setupError.hidden = true;
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => { if (done) return; done = true; setupForm.removeEventListener('submit', onSubmit); setup.removeEventListener('close', onClose); resolve(value); };
      const onClose = () => finish(false);
      const onSubmit = async (event) => {
        event.preventDefault();
        const password = document.querySelector('#lock-new').value;
        const confirm = document.querySelector('#lock-confirm').value;
        const problem = password.length < 6 ? 'Use at least 6 characters.' : password !== confirm ? 'The two passwords do not match.' : '';
        setupError.textContent = problem;
        setupError.hidden = !problem;
        if (problem) return;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await derive(password, salt, ITERATIONS);
        record = { salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS };
        await storage.set(KEY, record);
        finish(true);
        setup.close();
      };
      setupForm.addEventListener('submit', onSubmit);
      setup.addEventListener('close', onClose);
      setup.showModal();
    });
  }

  async function verify(password) {
    const saved = await load();
    if (!saved) return false;
    return sameBytes(await derive(password, fromBase64(saved.salt), saved.iterations), fromBase64(saved.hash));
  }

  function askPassword() {
    promptError.hidden = true;
    promptForm.reset();
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => { if (done) return; done = true; promptForm.removeEventListener('submit', onSubmit); prompt.removeEventListener('close', onClose); resolve(value); };
      const onClose = () => finish(false);
      const onSubmit = async (event) => {
        event.preventDefault();
        if (Date.now() < waitUntil) {
          promptError.textContent = `Too many attempts. Try again in ${Math.ceil((waitUntil - Date.now()) / 1000)} s.`;
          promptError.hidden = false;
          return;
        }
        if (await verify(document.querySelector('#lock-password').value)) {
          failures = 0;
          unlockedUntil = Date.now() + UNLOCK_MS;
          finish(true);
          promptDialog.close();
          return;
        }
        failures += 1;
        if (failures >= 3) waitUntil = Date.now() + Math.min(300, 5 * 2 ** (failures - 3)) * 1000;
        promptError.textContent = 'That password is not correct.';
        promptError.hidden = false;
        prompt.classList.remove('shake');
        void prompt.offsetWidth;
        prompt.classList.add('shake');
        document.querySelector('#lock-password').select();
      };
      promptForm.addEventListener('submit', onSubmit);
      prompt.addEventListener('close', onClose);
      promptDialog.open();
    });
  }

  return {
    enabled,
    // First run: someone else chooses the password before anything can be changed.
    async ensureSetup() {
      if (!enabled || await load()) return;
      while (!(await showSetup({
        title: 'Set a password',
        intro: 'Ask someone you trust to choose a password and keep it. It will be required to change website schedules and limits, so you cannot change them yourself.',
        cancelable: false,
      })));
    },
    isUnlocked: () => !enabled || Date.now() < unlockedUntil,
    relock() { unlockedUntil = 0; },
    async ensureUnlocked() {
      if (!enabled) return true;
      if (!(await load())) await this.ensureSetup();
      if (Date.now() < unlockedUntil) return true;
      return askPassword();
    },
    async changePassword() {
      if (!enabled || !(await this.ensureUnlocked())) return false;
      return showSetup({ title: 'Change password', intro: 'Choose a new password. The old one stops working immediately.', cancelable: true });
    },
  };
}
