import { t } from './i18n';
import type { FriendsApi } from './friends';
import type { GameSession } from './game';
import { gameHas, KEY_FRIEND } from './gamekeys';
import { pageDialog } from './padnav';
import { parseFriendBump, type FriendBump } from './friend-bump';

type FriendPromptState = 'checking' | 'new' | 'asks' | 'asked' | 'friends' | 'claim' | 'theirs' | 'unavailable';

interface FriendPromptDeps {
  api: FriendsApi;
  /** current FriendPrompt key code (null: explicitly off) */
  friendKey(): string | null;
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
  private state: FriendPromptState = 'checking';
  private busy = false;

  constructor(stage: HTMLElement, private readonly deps: FriendPromptDeps) {
    this.root = document.createElement('div');
    this.root.className = 'friends-crew-invite friend-bump-prompt';
    this.root.hidden = true;
    this.root.setAttribute('role', 'group');
    this.copy = document.createElement('span');
    this.copy.setAttribute('aria-live', 'polite');
    this.copy.setAttribute('aria-atomic', 'true');
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
    this.state = 'checking';
    this.busy = false;
    this.render();
  }

  stop() {
    this.session = null;
    this.enabled = false;
    this.target = null;
    this.state = 'checking';
    this.busy = false;
    this.render();
  }

  private key(event: KeyboardEvent) {
    const key = this.deps.friendKey();
    if (!key || event.code !== key || !this.enabled || !this.target || !this.actionable() || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
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
      this.state = 'checking';
      this.busy = false;
      this.render();
      void this.check(event);
    } else if (this.target?.id === event.id) {
      this.target = null;
      this.state = 'checking';
      this.busy = false;
      this.render();
    }
  }

  private actionable() { return this.state === 'new' || this.state === 'asks'; }

  private async check(target: FriendBump) {
    try {
      const state = await this.deps.api.can(target.name);
      if (!this.enabled || this.target?.id !== target.id) return;
      this.state = state && ['new', 'asks', 'asked', 'friends', 'claim', 'theirs'].includes(state)
        ? state as FriendPromptState : 'unavailable';
    } catch (error) {
      if (this.target?.id !== target.id) return;
      this.state = 'unavailable';
      this.deps.log(`[friends] could not check ${target.name}: ${error}`);
    }
    this.render();
  }

  private render() {
    const target = this.target;
    this.root.hidden = !this.enabled || !target;
    if (!target) return;
    const name = target.name;
    const messages: Record<FriendPromptState, string> = {
      checking: t('Checking friend status for {name}', { name }),
      new: t('You and {name} have touched front bumpers for 3 seconds. Add as a friend?', { name }),
      asks: t('{name} has sent you a friend request. Accept it?', { name }),
      asked: t('Your friend request to {name} is pending.', { name }),
      friends: t('You and {name} are already friends.', { name }),
      claim: t('Claim your player name before adding friends.'),
      theirs: t('{name} must claim a player name before you can add them.', { name }),
      unavailable: t('Friend status is temporarily unavailable.'),
    };
    this.copy.textContent = messages[this.state];
    const canAct = this.actionable();
    this.button.hidden = !canAct;
    this.button.textContent = this.busy ? t('Sending friend request')
      : this.state === 'asks' ? t('Accept friend request') : t('Add as a friend');
    this.button.disabled = this.busy;
  }

  private async ask() {
    const target = this.target;
    if (!this.enabled || !target || !this.actionable() || this.busy) return;
    const op = this.state === 'asks' ? 'accept' : 'ask';
    this.busy = true;
    this.render();
    try {
      const result = await this.deps.api.act(op, target.name);
      if (this.target?.id !== target.id) return;
      if (!result) {
        this.state = 'unavailable';
        this.deps.toast(t('Friends are unavailable. Claim your name and connect to the server first.'), 6000);
        return;
      }
      switch (result.done) {
        case 'asked':
          this.state = 'asked';
          this.deps.toast(t('Friend request sent.'), 5000);
          this.deps.refresh();
          break;
        case 'ok':
        case 'friends':
          this.state = 'friends';
          this.deps.toast(t('You are friends now.'), 5000);
          this.deps.refresh();
          break;
        case 'full': this.deps.toast(t('A friends list is full (250 at most).'), 5000); break;
        case 'rate': this.deps.toast(t('Wait a moment.'), 4000); break;
        case 'claim':
          this.state = 'claim';
          this.deps.toast(t('Friends are unavailable. Claim your name and connect to the server first.'), 6000);
          break;
        case 'theirs':
          this.state = 'theirs';
          this.deps.toast(t('{name} must claim a player name before you can add them.', { name: target.name }), 5000);
          break;
        default:
          this.state = 'unavailable';
          this.deps.toast(t('The friend request could not be sent.'), 5000);
          this.deps.log(`[friends] bump request to ${target.name}: ${result.done ?? 'no result'}`);
      }
    } catch (error) {
      if (this.target?.id === target.id) {
        this.state = 'unavailable';
        this.deps.log(`[friends] bump request to ${target.name}: ${error}`);
        this.deps.toast(t('The friend request could not be sent.'), 5000);
      }
    } finally {
      this.busy = false;
      this.render();
    }
  }
}
