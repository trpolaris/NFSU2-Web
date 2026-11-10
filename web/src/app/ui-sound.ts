const STORAGE_KEY = 'trpolaris.nfsu2.ui-sounds.v1';
type UiSound = 'hover' | 'click';

function readPreference(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== '0'; }
  catch { return true; }
}

/** Optional interaction sounds shared by the F9 deck and the in-game chat. */
class UiSoundBus {
  private active = readPreference();
  private readonly files: Record<UiSound, HTMLAudioElement>;

  constructor() {
    this.files = {
      hover: new Audio('/ui-hover.mp3'),
      click: new Audio('/ui-click.mp3'),
    };
    for (const audio of Object.values(this.files)) {
      audio.preload = 'auto';
      audio.load();
    }
  }

  get enabled(): boolean { return this.active; }

  setEnabled(enabled: boolean): boolean {
    this.active = !!enabled;
    try { localStorage.setItem(STORAGE_KEY, this.active ? '1' : '0'); }
    catch { /* the setting remains active for this page session */ }
    return this.active;
  }

  play(kind: UiSound): void {
    if (!this.active) return;
    try {
      // Clone the preloaded element so rapid consecutive interactions never cut off the previous effect.
      const audio = this.files[kind].cloneNode(true) as HTMLAudioElement;
      audio.volume = kind === 'hover' ? 0.16 : 0.25;
      void audio.play().catch(() => {});
    } catch { /* audio is optional; the interface remains fully usable */ }
  }
}

export const uiSounds = new UiSoundBus();
let bound = false;

/** Delegate sounds so dynamically-created chat messages and controls are covered too. */
export function bindUiSounds(): void {
  if (bound || typeof document === 'undefined') return;
  bound = true;

  document.addEventListener('pointerover', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const root = target.closest('#menu, #racingChat');
    if (!root) return;
    const control = target.closest<HTMLElement>('button, a[href], select, summary, [role="button"]');
    if (!control || control.hasAttribute('disabled') || control.dataset.noSound === 'true') return;
    const related = event.relatedTarget;
    if (related instanceof Node && control.contains(related)) return;
    uiSounds.play('hover');
  }, true);

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const root = target.closest('#menu, #racingChat');
    if (!root) return;
    const control = target.closest<HTMLElement>('button, a[href], select, summary, [role="button"]');
    if (!control || control.hasAttribute('disabled') || control.dataset.noSound === 'true') return;
    uiSounds.play('click');
  }, true);
}
