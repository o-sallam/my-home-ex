import iconFiles from './icon-files.json';

export function safeColor(color) { return /^#[\da-f]{6}$/i.test(color) ? color : '#75baff'; }

export function safeImage(value) {
  return typeof value === 'string' && value.length <= 200_000 &&
    /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(value) ? value : null;
}

export function createIcon(card) {
  const holder = document.createElement('span');
  holder.className = 'brand-icon';
  holder.setAttribute('aria-hidden', 'true');
  holder.style.setProperty('--icon-color', safeColor(card.color));
  const initial = String(card.label || '?').trim().slice(0, 1).toUpperCase();
  const image = safeImage(card.image);
  const file = Object.hasOwn(iconFiles, card.icon || '') ? iconFiles[card.icon] : null;
  if (image || file) {
    const src = image || `${import.meta.env.BASE_URL}assets/icons/${file}`;
    // Flat silhouette: white by default, the card color on hover.
    holder.classList.add('legacy-icon');
    holder.style.maskImage = `url("${src}")`;
  } else {
    holder.textContent = initial;
    holder.classList.add('initial-icon');
  }
  return holder;
}
