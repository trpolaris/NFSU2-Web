// Mark the player application as started before the rest of main.ts is evaluated.
// This lets the pre-main boot script clear its warning if a slow module starts late.
document.documentElement.dataset.started = '';
window.dispatchEvent(new Event('nfsu2-started'));

export {};
