// Native dialogs provide focus trapping, Escape handling and focus restoration.
export function setupDialog(dialog) {
  let closeTimer;
  const close = () => {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    closeTimer = setTimeout(() => {
      dialog.close();
      dialog.classList.remove('is-closing');
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140);
  };
  dialog.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  return {
    open() {
      clearTimeout(closeTimer);
      dialog.classList.remove('is-closing');
      dialog.showModal();
    },
    close,
  };
}
