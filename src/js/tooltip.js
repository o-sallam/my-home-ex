// One shared, animated tooltip for grid cells (replaces the browser's native title bubble).
export function setupTooltip(grid) {
  const tip = document.querySelector('#tooltip');
  const title = tip.querySelector('.tip-title');
  const sub = tip.querySelector('.tip-sub');
  const key = tip.querySelector('.tip-key');
  let current = null;
  let timer;

  function hide() {
    clearTimeout(timer);
    current = null;
    tip.classList.remove('show');
    tip.classList.remove('glide');
  }

  function place(cell) {
    const box = cell.getBoundingClientRect();
    const tipBox = tip.getBoundingClientRect();
    const gap = 10;
    const below = box.top - tipBox.height - gap < 64;
    const x = Math.max(8, Math.min(box.left + box.width / 2 - tipBox.width / 2, innerWidth - tipBox.width - 8));
    const y = below ? box.bottom + gap : box.top - tipBox.height - gap;
    tip.classList.toggle('below', below);
    tip.style.setProperty('--arrow-x', `${box.left + box.width / 2 - x}px`);
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function show(cell) {
    if (!cell.isConnected || !cell.dataset.tip) return;
    const wasShown = tip.classList.contains('show');
    current = cell;
    title.textContent = cell.dataset.tip;
    sub.textContent = cell.dataset.tipSub || '';
    sub.hidden = !cell.dataset.tipSub;
    key.textContent = cell.dataset.tipKey || '';
    key.hidden = !cell.dataset.tipKey;
    // Moving between cells glides; the first appearance just fades in place.
    tip.classList.toggle('glide', wasShown);
    place(cell);
    tip.classList.add('show');
  }

  function schedule(cell, delay) {
    clearTimeout(timer);
    if (cell === current) return;
    timer = setTimeout(() => show(cell), tip.classList.contains('show') ? 0 : delay);
  }

  grid.addEventListener('mouseover', (event) => {
    const cell = event.target.closest('.cell');
    if (cell) schedule(cell, 380);
    else hide();
  });
  grid.addEventListener('mouseleave', hide);
  grid.addEventListener('focusin', (event) => {
    const cell = event.target.closest('.cell');
    if (cell?.matches(':focus-visible')) schedule(cell, 0);
  });
  grid.addEventListener('focusout', hide);
  grid.addEventListener('pointerdown', hide);
  grid.addEventListener('dragstart', hide);
  document.addEventListener('contextmenu', hide);
  addEventListener('scroll', hide, true);
  addEventListener('resize', hide);
  addEventListener('blur', hide);
  return { hide };
}
