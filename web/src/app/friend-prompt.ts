import { t } from './i18n';
import type { FriendsApi } from './friends';
import type { GameSession } from './game';
import { gameHas, KEY_FRIEND } from './gamekeys';
import { pageDialog } from './padnav';
import { parseFriendBump, type FriendBump } from './friend-bump';

interface FriendPromptDeps {
  api: FriendsApi;
  toast(message: string, ms: number): void;
  log(line: string): void;
  refresh(): void;
}

/** Click-to-send Add Friend prompt for a verified 3-second front-bumper contact in Free Roam. */
export class FriendPrompt {
  private readonly root: HTMLDivElement;
  private readonly copy: HTMLSpanElement;
  private readonly button: HTMLButtonElement;
  private enabled = false;
  private session: GameSession | null = null;
  private readonly onKeyDown = (event: KeyboardEvent) => this.key(event);
  private target: FriendBump | null = null;
  private busy = false;

  constructor(stage: HTMLElement, private readonly deps: FriendPromptDeps) {
    this.root = document.createElement('div');
    this.root.className = 'friends-crew-invite friend-bump-prompt';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.copy = document.createElement('span');
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = t('Add as a friend');
    this.button.onclick = () => void this.ask();
    this.root.append(this.copy, this.button);
    (stage.querySelector<HTMLElement>('.toasts') ?? stage).prepend(this.root);
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  start(session: GameSession, enabled: boolean) {
    this.session = session;
    this.enabled = enabled;
    this.target = null;
    this.busy = false;
    this.render();
  }

  stop() {
    this.session = null;
    this.enabled = false;
    this.target = null;
    this.busy = false;
    this.render();
  }

  private key(event: KeyboardEvent) {
    if (event.code !== 'KeyF' || !this.enabled || !this.target || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]') || pageDialog() || gameHas(this.session, KEY_FRIEND)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) void this.ask();
  }

  bump(json: string) {
    const event = parseFriendBump(json);
    if (!this.enabled || !event) return;
    if (event.on) {
      this.target = event;
      this.render();
    } else if (this.target?.id === event.id) {
      this.target = null;
      this.render();
    }
  }

  private render() {
    const target = this.target;
    this.root.hidden = !this.enabled || !target;
    if (!target) return;
    this.copy.textContent = t('You and {name} have touched front bumpers for 3 seconds. Add as a friend?', { name: target.name });
    this.button.textContent = this.busy ? t('Sending friend request') : t('Add as a friend');
    this.button.disabled = this.busy;
  }

  private async ask() {
    const target = this.target;
    if (!this.enabled || !target || this.busy) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.deps.api.act('ask', target.name);
      if (!result) {
        this.deps.toast(t('Friends are unavailable. Claim your name and connect to the server first.'), 6000);
        return;
      }
      switch (result.done) {
        case 'asked':
          this.deps.toast(t('Friend request sent.'), 5000);
          this.deps.refresh();
          if (this.target?.id === target.id) this.target = null;
          break;
        case 'friends':
          this.deps.toast(t('You are friends now.'), 5000);
          this.deps.refresh();
          if (this.target?.id === target.id) this.target = null;
          break;
        case 'full': this.deps.toast(t('A friends list is full (250 at most).'), 5000); break;
        case 'rate': this.deps.toast(t('Wait a moment.'), 4000); break;
        case 'claim': this.deps.toast(t('Friends are unavailable. Claim your name and connect to the server first.'), 6000); break;
        default:
          this.deps.toast(t('The friend request could not be sent.'), 5000);
          this.deps.log(`[friends] bump request to ${target.name}: ${result.done ?? 'no result'}`);
      }
    } catch (error) {
      this.deps.log(`[friends] bump request to ${target.name}: ${error}`);
      this.deps.toast(t('The friend request could not be sent.'), 5000);
    } finally {
      this.busy = false;
      this.render();
    }
  }
}
