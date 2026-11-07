// FreeRoam chat combines the original phrase picker with typed room/Crew messages, live-player mentions and
// server-enforced moderation. Players read game phrases in their own language and can type to one another.
// Each player picks sixteen of the library's
// (phrases.ts) on the start page, in four groups of four (settings.ini quick_chat_phrases, quick_chat_groups).
//   pick   keys 1-4 open a group and 1-4 again says its phrase; a controller's right stick the same (a flick up, right,
//          down or left: the game leaves that stick unused); on a touch screen the chat button shows all sixteen and a
//          tap says one.  Esc, PICK_MS without a pick, or no longer driving in free roam closes it.  At most BURST
//          phrases in WINDOW_MS (runtime/roam_game.c keeps the same limit): then the picker asks to wait.
//   wire   a phrase is its number in the library: the game sends it to the players around (roam_game.c say_*: within
//          250 m, or in our race lobby) and back to this page as said by the player.  A number this page has no phrase
//          for (a newer page's) is not shown.
//   show   a line over the car of each player who said something, where the game draws the name over it: the game
//          tells where in each frame it draws (marks(), the renderer's GwMarks), so the line moves with the car in the
//          same picture; the player's own over their car.  Also the chat log on the left, in the notices' place, and
//          beside the player's name in a race lobby's card.
import type { GameSession } from './game';
import { N, language, onLanguage, t } from './i18n';
import { hasChatProfanity } from './chat-filter';
import { catName, DEFAULT_GROUPS, DEFAULT_PHRASES, PHRASES, type CatId } from './phrases';

/** the picker closes this long after it opened or the last pick in it (ms) */
const PICK_MS = 4000;
/** at most BURST phrases in WINDOW_MS (roam_game.c SAY_BURST, SAY_WINDOW_US) */
const BURST = 3, WINDOW_MS = 6000;
/** a line over a car: this long (ms; roam_game.c SAY_SHOW_US), the last FADE_MS of it fading */
const SHOW_MS = 5000, FADE_MS = 600;
/** typed chat: keep the HUD's DOM history bounded even while its composer is open */
const CHAT_HISTORY_LIMIT = 200;
/** mirror the hub's typed-chat allowance: four accepted messages in any rolling five-second window */
const CHAT_RATE_MAX = 4, CHAT_RATE_WINDOW_MS = 5000;
/** while the composer is closed, old lines fade visually but remain in the 200-message session history */
const CHAT_MESSAGE_MS = 5000;
/** the name over a friend's car is about this tall (HUD units at scale 1): the line goes above it */
const NAME_H = 13;
/** a line shrinks with the distance as the name under it does (to 0.5), but not below this: it stays readable */
const LINE_MIN = 0.7;
/** the right stick: a flick is past FLICK of its travel, and counts again once back within REST */
const FLICK = 0.8, REST = 0.35;
/** the stick's flicks and the keys' places, in the order of a group's phrases: up, right, down, left */
const ARROWS = ['↑', '→', '↓', '←'];
/** The three original buttons and text payloads from the supplied racing-chat client. */
const QUICK_CHAT = [
  { label: 'Selam!', text: 'Selam!' },
  { label: 'GG!', text: 'Güzel yarıştı beyler! 🏁' },
  { label: 'Yoldayım', text: 'Yoldayım, geliyorum!' },
  { label: 'Hazırım', text: 'Hazırım!' },
] as const;
/** a speech balloon: what marks a line as chat */
export const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 2.6V12H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg>';

/** what the game sends (roam_game.c say_page) */
interface Said { id: number; name: string; p: number; me?: number; lobby?: number; race?: number }
interface TypedChat { id: number; name: string; text: string; scope: 'room' | 'crew'; channel: number; me?: boolean }
interface CrewChannel { name: string; id: number }
type ExternalChatKind = 'GENEL' | 'EKİP' | 'OOC' | 'SİSTEM';
interface ExternalChatLine {
  id: string; channel: ExternalChatKind; user: string; msg: string; time: string; timestamp: number;
}

export interface QuickChatDeps {
  /** a line in the chat log (the notices' place): the name, what was said, whether it is the player's own */
  line(name: string, text: string, me: boolean): void;
  /** the race lobby's card: what a player said, beside their name */
  lobby(name: string, text: string): void;
  /** the picker's place (the notices', placed again for the picture's size now: place()) */
  place(): void;
  log(s: string): void;
}

type Mode = 'keys' | 'pad' | 'touch';
type ChatFilter = 'all' | 'room' | 'crew' | 'system';
type ChatPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const SENDER_COLORS = ['#7dd3fc', '#c4b5fd', '#f9a8d4', '#86efac', '#fdba74', '#a5b4fc', '#fca5a5', '#67e8f9'] as const;
function stableSenderColor(name: string): string {
  let hash = 2166136261;
  for (const ch of name.normalize('NFKC').toLocaleLowerCase()) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return SENDER_COLORS[(hash >>> 0) % SENDER_COLORS.length];
}
function normalizedPlayerName(name: string): string { return name.normalize('NFKC').trim().toLocaleLowerCase(); }
const KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };

export class QuickChat {
  private session: GameSession | null = null;
  private on = false;
  private layer: HTMLElement;
  private picker: HTMLElement;
  private chatHud: HTMLElement;
  private chatMessages: HTMLElement;
  private historyButton: HTMLButtonElement;
  private followingChat = true;
  private chatTools: HTMLElement;
  private searchInput: HTMLInputElement;
  private searchButton: HTMLButtonElement;
  private chatHeader: HTMLElement;
  private mentionSoundButton: HTMLButtonElement;
  private mutedButton: HTMLButtonElement;
  private mutedPanel: HTMLElement;
  private mutedList: HTMLElement;
  private chatFilter: ChatFilter = 'all';
  private chatSearch = '';
  private mentionSound = true;
  private mutedPlayers = new Set<string>();
  private playerName = '';
  private chatBox: HTMLElement;
  private channelButton: HTMLElement;
  private chatInput: HTMLInputElement;
  private mentionSuggestions: HTMLDivElement;
  private mentionResults: { name: string; activity: string }[] = [];
  private mentionRange: { start: number; end: number } | null = null;
  private mentionIndex = 0;
  private mentionPlayers: { name: string; activity: string }[] = [];
  private mentionPlayersFetchedAt = 0;
  private mentionPlayersRequest: Promise<void> | null = null;
  private crews: CrewChannel[] = [];
  private channelIndex = 0;
  private messageTimers = new Map<HTMLElement, { fade: number }>();
  /** local mirror of the server's rolling typed-chat limit, for immediate feedback before a send */
  private chatSentAt: number[] = [];
  private lastRateNoticeAt = -Infinity;
  /** the lines over cars by the player's id (until: performance.now() it goes; out: fading) */
  private lines = new Map<number, { el: HTMLElement; until: number; me: boolean; shown: boolean; out: boolean }>();
  /** the picker: closed (-1), a group open (0-3), all of them (4, touch) */
  private open = -1;
  private mode: Mode = 'keys';
  private closeTimer = 0;
  private sent: number[] = [];
  private drive = 0;
  private driveAt = 0;
  private netrace = 0;
  private blocked = new Set<string>();
  private armed = true;
  /** the HUD's local display preferences; these never alter the game's network or save data */
  private compactMessageFlow = true;
  private showMessageTimestamps = true;
  private chatAppearance: { scale: number; opacity: number; position: ChatPosition; width: number } = {
    scale: 0.9, opacity: 0.72, position: 'top-left', width: 360,
  };
  /** The standalone chat popup shares this tab's live Rust session via BroadcastChannel. */
  private externalChatBus: BroadcastChannel | null = null;
  private externalChatLines: ExternalChatLine[] = [];
  private externalChatReady = false;
  /** the player's sixteen: the phrase in each slot (group * 4 + place), and each group's name */
  private layout: readonly number[] = DEFAULT_PHRASES;
  private groups: readonly CatId[] = DEFAULT_GROUPS;

  constructor(stage: HTMLElement, private deps: QuickChatDeps) {
    this.layer = document.createElement('div');
    this.layer.className = 'qc-lines';
    this.picker = document.createElement('div');
    this.picker.className = 'qc-picker';
    this.picker.hidden = true;
    this.picker.dataset.nfsu2Ui = '';
    this.picker.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (target.closest<HTMLElement>('[data-chat-text]')) { this.openTextChat(); return; }
      const b = target.closest<HTMLElement>('[data-slot]');
      if (b) this.pick(+b.dataset.slot!);
    });
    this.picker.addEventListener('pointerdown', e => e.preventDefault());    // the canvas keeps the focus (and the keys)
    // The chat DOM follows the supplied racing HUD markup and class names.
    this.chatHud = document.createElement('div');
    this.chatHud.className = 'racing-chat-wrapper';
    this.chatHud.id = 'racingChat';
    this.chatHud.dataset.nfsu2Ui = '';
    this.chatHud.dataset.gameReady = 'false';
    this.chatHud.hidden = true;
    this.loadChatAppearance();
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.externalChatBus = new BroadcastChannel('trpolaris.nfsu2.chat.v1');
        this.externalChatBus.addEventListener('message', event => this.handleExternalChatMessage(event.data));
      } catch { this.externalChatBus = null; }
    }

    this.chatMessages = document.createElement('div');
    this.chatMessages.className = 'chat-messages';
    this.chatMessages.id = 'chatMessages';
    this.chatMessages.addEventListener('scroll', () => this.updateChatScrollState(), { passive: true });

    this.historyButton = document.createElement('button');
    this.historyButton.type = 'button';
    this.historyButton.className = 'chat-history-latest';
    this.historyButton.id = 'chatHistoryLatest';
    this.historyButton.textContent = `${t('New messages')} ↓`;
    this.historyButton.setAttribute('aria-label', t('Show newest chat messages'));
    this.historyButton.title = t('Show newest chat messages');
    this.historyButton.hidden = true;
    this.historyButton.addEventListener('click', () => this.scrollChatToLatest(true));

    this.chatHeader = document.createElement('div');
    this.chatHeader.className = 'chat-hud-header';
    const chatIdentity = document.createElement('div');
    chatIdentity.className = 'chat-hud-identity';
    chatIdentity.innerHTML = '<span class="chat-hud-live-dot"></span><span><strong>TRPOLARIS CHAT</strong><small>BAYVIEW · CANLI İLETİŞİM</small></span>';
    const headerActions = document.createElement('div');
    headerActions.className = 'chat-hud-actions';
    this.searchButton = document.createElement('button');
    this.searchButton.type = 'button';
    this.searchButton.className = 'chat-search-toggle';
    this.searchButton.setAttribute('aria-expanded', 'false');
    this.searchButton.setAttribute('aria-controls', 'chatTools');
    this.searchButton.setAttribute('aria-label', t('Search chat history'));
    this.searchButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.7" cy="8.7" r="5.7"></circle><path d="m13 13 4 4"></path></svg><span>ARA</span>';
    this.searchButton.addEventListener('click', () => {
      if (!this.chatHud.classList.contains('active') && !this.openTextChat()) return;
      const open = !this.chatHud.classList.contains('search-open');
      this.chatHud.classList.toggle('search-open', open);
      this.searchButton.setAttribute('aria-expanded', String(open));
      if (open) this.searchInput.focus(); else this.searchInput.blur();
    });
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'chat-close-button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', t('Close chat'));
    closeButton.addEventListener('click', () => this.closeTextChat());
    headerActions.append(this.searchButton, closeButton);
    this.chatHeader.append(chatIdentity, headerActions);

    this.chatTools = document.createElement('div');
    this.chatTools.id = 'chatTools';
    this.chatTools.className = 'chat-tools';
    const filterGroup = document.createElement('div');
    filterGroup.className = 'chat-filter-group';
    filterGroup.setAttribute('role', 'group');
    filterGroup.setAttribute('aria-label', t('Chat filters'));
    for (const [filter, label] of [
      ['all', 'All messages'], ['room', 'Everyone'], ['crew', 'Crew chat'], ['system', 'System messages'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-filter';
      button.dataset.chatFilter = filter;
      button.textContent = t(label);
      button.setAttribute('aria-pressed', String(filter === this.chatFilter));
      button.addEventListener('click', () => {
        this.chatFilter = filter;
        this.applyChatView();
        this.updateChatToolStates();
      });
      filterGroup.append(button);
    }
    this.searchInput = document.createElement('input');
    this.searchInput.className = 'chat-search';
    this.searchInput.type = 'search';
    this.searchInput.autocomplete = 'off';
    this.searchInput.spellcheck = false;
    this.searchInput.placeholder = t('Search chat…');
    this.searchInput.setAttribute('aria-label', t('Search chat…'));
    this.searchButton.setAttribute('aria-label', t('Search chat history'));
    this.searchInput.addEventListener('input', () => {
      this.chatSearch = this.searchInput.value.trim().toLocaleLowerCase();
      this.applyChatView();
    });
    this.mentionSoundButton = document.createElement('button');
    this.mentionSoundButton.type = 'button';
    this.mentionSoundButton.className = 'chat-tool-button';
    this.mentionSoundButton.addEventListener('click', () => {
      this.mentionSound = !this.mentionSound;
      try { localStorage.setItem('trpolaris.nfsu2.chat-mention-sound.v1', this.mentionSound ? '1' : '0'); } catch { /* current session */ }
      this.updateChatToolStates();
    });
    this.mutedButton = document.createElement('button');
    this.mutedButton.type = 'button';
    this.mutedButton.className = 'chat-tool-button';
    this.mutedButton.addEventListener('click', () => {
      this.mutedPanel.hidden = !this.mutedPanel.hidden;
      this.renderMutedPlayers();
      this.updateChatToolStates();
    });
    this.mutedPanel = document.createElement('div');
    this.mutedPanel.className = 'chat-muted-panel';
    this.mutedPanel.hidden = true;
    this.mutedList = document.createElement('div');
    this.mutedList.className = 'chat-muted-list';
    this.mutedPanel.append(this.mutedList);
    this.chatTools.append(filterGroup, this.searchInput, this.mentionSoundButton, this.mutedButton);
    this.chatMessages.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-chat-mute]');
      if (button?.dataset.chatMute) this.toggleMuted(button.dataset.chatMute);
    });
    this.loadChatLocalPreferences();
    this.updateChatToolStates();
    this.renderMutedPlayers();
    onLanguage(() => {
      const label = t('Show newest chat messages');
      this.historyButton.textContent = `${t('New messages')} ↓`;
      this.historyButton.setAttribute('aria-label', label);
      this.historyButton.title = label;
      this.updateChatToolsLanguage();
    });

    const channelTabs = document.createElement('div');
    channelTabs.className = 'chat-channel-tabs';
    channelTabs.setAttribute('role', 'group');
    channelTabs.setAttribute('aria-label', 'Sohbet kanalı');
    for (const [id, label] of [['room', 'GENEL'], ['crew', 'EKİP'], ['ooc', 'OOC']] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-channel-tab';
      button.dataset.chatChannel = id;
      button.textContent = label;
      button.setAttribute('aria-pressed', String(id === 'room'));
      button.addEventListener('click', () => {
        if (id === 'ooc') {
          this.systemMessage('OOC kanalı mevcut Rust sohbet protokolünde henüz desteklenmiyor.');
          return;
        }
        if (id === 'crew' && !this.crews.length) {
          this.systemMessage('Ekip sohbeti için önce bir ekip oluşturmalısın.');
          return;
        }
        this.channelIndex = id === 'room' ? 0 : 1;
        this.updateChannel();
      });
      channelTabs.append(button);
    }

    const quick = document.createElement('div');
    quick.className = 'quick-chat-panel';
    quick.id = 'quickChatPanel';
    for (const item of QUICK_CHAT) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.dataset.quickText = item.text;
      quick.append(button);
    }
    quick.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-quick-text]');
      if (button?.dataset.quickText) this.sendQuick(button.dataset.quickText);
    });

    this.chatBox = document.createElement('div');
    this.chatBox.className = 'chat-input-area';
    this.chatBox.id = 'chatInputArea';

    this.channelButton = document.createElement('span');
    this.channelButton.className = 'active-channel';
    this.channelButton.id = 'activeChannel';

    this.chatInput = document.createElement('input');
    this.chatInput.className = 'chat-input';
    this.chatInput.id = 'chatInput';
    this.chatInput.type = 'text';
    this.chatInput.maxLength = 80;
    this.chatInput.autocomplete = 'off';
    this.chatInput.spellcheck = true;
    this.chatInput.setAttribute('aria-autocomplete', 'list');
    this.chatInput.setAttribute('aria-controls', 'chatMentionSuggestions');
    this.chatInput.setAttribute('aria-expanded', 'false');
    this.chatInput.addEventListener('input', () => { void this.updateMentionSuggestions(); });

    this.mentionSuggestions = document.createElement('div');
    this.mentionSuggestions.className = 'chat-mention-suggestions';
    this.mentionSuggestions.id = 'chatMentionSuggestions';
    this.mentionSuggestions.hidden = true;
    this.mentionSuggestions.setAttribute('role', 'listbox');
    this.mentionSuggestions.addEventListener('pointerdown', event => event.preventDefault());
    this.mentionSuggestions.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mention-index]');
      if (button) this.chooseMention(Number(button.dataset.mentionIndex));
    });

    const sendButton = document.createElement('button');
    sendButton.type = 'button';
    sendButton.className = 'chat-send-button';
    sendButton.setAttribute('aria-label', 'Mesajı gönder');
    sendButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8zM7 12h14"/></svg>';
    sendButton.addEventListener('click', () => this.sendText());
    this.chatBox.append(this.channelButton, this.chatInput, this.mentionSuggestions, sendButton);
    this.chatBox.addEventListener('pointerdown', e => e.stopPropagation());
    this.updateChatToolsLanguage();
    this.chatHud.append(this.chatHeader, channelTabs, this.chatMessages, this.historyButton, this.chatTools, this.mutedPanel, quick, this.chatBox);
    stage.append(this.layer, this.picker, this.chatHud);
    // caught before the game's input (attached later, at each Play): the keys the picker uses go to it alone
    window.addEventListener('keydown', e => this.key(e), { capture: true });
    stage.addEventListener('pointerdown', e => {
      if (this.open === 4 && !this.picker.contains(e.target as Node) && !(e.target as Element).closest?.('[data-ctl="chat"]')) this.close();
    }, { capture: true });
  }

  /** Read and apply the player's HUD-only chat preferences. Values are bounded to keep the overlay usable. */
  private loadChatAppearance() {
    try {
      const saved = JSON.parse(localStorage.getItem('trpolaris.nfsu2.chat-hud.v1') || 'null') as {
        scale?: unknown; opacity?: unknown; position?: unknown; width?: unknown;
      } | null;
      if (saved && typeof saved === 'object') {
        const scale = Number(saved.scale), opacity = Number(saved.opacity), width = Number(saved.width);
        if (Number.isFinite(scale)) this.chatAppearance.scale = Math.min(1.15, Math.max(0.75, scale));
        if (Number.isFinite(opacity)) this.chatAppearance.opacity = Math.min(0.92, Math.max(0.35, opacity));
        if (Number.isFinite(width)) this.chatAppearance.width = Math.min(520, Math.max(280, width));
        if (['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(String(saved.position))) {
          this.chatAppearance.position = saved.position as ChatPosition;
        }
      }
    } catch { /* Storage may be unavailable in private or restricted browser contexts. */ }
    this.applyChatAppearance();
  }

  private applyChatAppearance() {
    this.chatHud.style.setProperty('--chat-scale', String(this.chatAppearance.scale));
    this.chatHud.style.setProperty('--chat-opacity', String(this.chatAppearance.opacity));
    this.chatHud.style.setProperty('--chat-width', `${this.chatAppearance.width}px`);
    this.chatHud.dataset.position = this.chatAppearance.position;
  }

  /** Current chat HUD appearance for the in-game control deck. */
  appearance() { return { ...this.chatAppearance }; }

  /** Update the HUD without reloading the game; stored per browser, not in the career or settings.ini. */
  setAppearance(scale: number, opacity: number, position?: ChatPosition, width?: number) {
    if (Number.isFinite(scale)) this.chatAppearance.scale = Math.min(1.15, Math.max(0.75, scale));
    if (Number.isFinite(opacity)) this.chatAppearance.opacity = Math.min(0.92, Math.max(0.35, opacity));
    if (position && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(position)) this.chatAppearance.position = position;
    if (width !== undefined && Number.isFinite(width)) this.chatAppearance.width = Math.min(520, Math.max(280, width));
    this.applyChatAppearance();
    try { localStorage.setItem('trpolaris.nfsu2.chat-hud.v1', JSON.stringify(this.chatAppearance)); }
    catch { /* The current session still uses the changed values. */ }
  }

  /** a game started: quick chat on (the setting) or off, with the player's sixteen (phrases.ts phrasesOf, groupsOf) */
  start(s: GameSession, on: boolean, layout: readonly number[], groups: readonly CatId[], crews: readonly CrewChannel[] = [], playerName = '', blocked: readonly string[] = []) {
    this.session = s; this.on = on; this.drive = 0; this.driveAt = 0; this.netrace = 0;
    this.blocked = new Set(blocked.map(normalizedPlayerName).filter(Boolean));
    // A GameSession can exist during startup/loading. Only FreeRoam driving may reveal the HUD.
    this.chatHud.dataset.gameReady = 'false';
    this.chatHud.hidden = true;
    this.playerName = playerName.trim();
    this.layout = layout; this.groups = groups; this.setCrews(crews);
    this.postExternalChatSnapshot();
  }
  setCrews(crews: readonly CrewChannel[]) {
    this.crews = crews.filter(c => c.name.trim() && Number.isSafeInteger(c.id) && c.id !== 0).slice(0, 4);
    this.channelIndex = Math.min(this.channelIndex, this.crews.length);
    if (this.channelButton) this.updateChannel();
    this.postExternalChatSnapshot();
  }
  private loadChatLocalPreferences() {
    try {
      const muted = JSON.parse(localStorage.getItem('trpolaris.nfsu2.chat-muted.v1') || '[]') as unknown;
      if (Array.isArray(muted)) this.mutedPlayers = new Set(muted.filter((x): x is string => typeof x === 'string').map(normalizedPlayerName).filter(Boolean));
      this.mentionSound = localStorage.getItem('trpolaris.nfsu2.chat-mention-sound.v1') !== '0';
      const prefs = JSON.parse(localStorage.getItem('trpolaris.nfsu2.chat-ui.v1') || 'null') as { compact?: unknown; timestamps?: unknown } | null;
      if (prefs && typeof prefs === 'object') {
        if (typeof prefs.compact === 'boolean') this.compactMessageFlow = prefs.compact;
        if (typeof prefs.timestamps === 'boolean') this.showMessageTimestamps = prefs.timestamps;
      }
      this.applyChatMessagePreferences();
    } catch { /* storage may be unavailable */ }
  }
  preferences() { return { compactMessageFlow: this.compactMessageFlow, showMessageTimestamps: this.showMessageTimestamps }; }

  setPreferences(compact: boolean, timestamps: boolean) {
    this.compactMessageFlow = !!compact;
    this.showMessageTimestamps = !!timestamps;
    this.applyChatMessagePreferences();
    try { localStorage.setItem('trpolaris.nfsu2.chat-ui.v1', JSON.stringify({ compact: this.compactMessageFlow, timestamps: this.showMessageTimestamps })); }
    catch { /* The current session still uses the changed values. */ }
  }

  private applyChatMessagePreferences() {
    this.chatHud.classList.toggle('compact-feed', this.compactMessageFlow);
    this.chatHud.classList.toggle('show-timestamps', this.showMessageTimestamps);
  }

  private updateChatToolsLanguage() {
    const labels: Record<ChatFilter, string> = {
      all: t('All messages'), room: t('Everyone'), crew: t('Crew chat'), system: t('System messages'),
    };
    for (const button of this.chatTools.querySelectorAll<HTMLButtonElement>('[data-chat-filter]')) {
      const key = button.dataset.chatFilter as ChatFilter;
      button.textContent = labels[key];
    }
    this.searchInput.placeholder = t('Search chat…');
    this.searchInput.setAttribute('aria-label', t('Search chat…'));
    this.chatInput.placeholder = t(N('Message… (@ player name)'));
    this.chatTools.querySelector('.chat-filter-group')?.setAttribute('aria-label', t('Chat filters'));
    this.renderMutedPlayers();
    this.updateChatToolStates();
    this.applyChatView();
  }
  private updateChatToolStates() {
    for (const button of this.chatTools.querySelectorAll<HTMLButtonElement>('[data-chat-filter]')) {
      const active = button.dataset.chatFilter === this.chatFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    this.mentionSoundButton.textContent = this.mentionSound ? t('Mention sound: on') : t('Mention sound: off');
    this.mentionSoundButton.setAttribute('aria-pressed', String(this.mentionSound));
    this.mutedButton.textContent = t('Muted: {n}', { n: this.mutedPlayers.size });
    this.mutedButton.setAttribute('aria-expanded', String(!this.mutedPanel.hidden));
  }
  private renderMutedPlayers() {
    if (!this.mutedList) return;
    this.mutedList.replaceChildren();
    if (!this.mutedPlayers.size) {
      this.mutedList.append(Object.assign(document.createElement('span'), { className: 'chat-muted-empty', textContent: t('No muted players') }));
      return;
    }
    for (const name of [...this.mutedPlayers].sort()) {
      const row = document.createElement('div'); row.className = 'chat-muted-entry';
      const label = document.createElement('span'); label.textContent = name;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = t('Unmute');
      button.dataset.chatUnmute = name;
      button.addEventListener('click', () => this.toggleMuted(name));
      row.append(label, button); this.mutedList.append(row);
    }
  }
  private toggleMuted(name: string) {
    const key = normalizedPlayerName(name);
    if (!key || key === normalizedPlayerName(this.playerName)) return;
    if (this.mutedPlayers.has(key)) this.mutedPlayers.delete(key); else this.mutedPlayers.add(key);
    try { localStorage.setItem('trpolaris.nfsu2.chat-muted.v1', JSON.stringify([...this.mutedPlayers])); } catch { /* current session */ }
    this.renderMutedPlayers();
    this.updateChatToolStates();
    this.applyChatView();
  }
  private applyChatView() {
    for (const row of this.chatMessages.children) {
      const el = row as HTMLElement;
      const scope = (el.dataset.scope || 'system') as ChatFilter;
      const sender = el.dataset.senderName || '';
      const muted = !!sender && this.mutedPlayers.has(normalizedPlayerName(sender));
      const mute = el.querySelector<HTMLButtonElement>('[data-chat-mute]');
      if (mute) {
        mute.textContent = muted ? '+' : '−';
        mute.title = muted ? t('Unmute player') : t('Mute player');
        mute.setAttribute('aria-label', mute.title);
      }
      const filterOk = this.chatFilter === 'all' || scope === this.chatFilter;
      const searchOk = !this.chatSearch || el.dataset.search?.includes(this.chatSearch) ||
        (el.textContent || '').toLocaleLowerCase().includes(this.chatSearch);
      el.hidden = muted || !filterOk || !searchOk;
    }
  }
  private isMention(text: string): boolean {
    const own = normalizedPlayerName(this.playerName);
    if (!own) return false;
    const needle = `@${own}`, body = text.normalize('NFKC').toLocaleLowerCase();
    let at = body.indexOf(needle);
    while (at >= 0) {
      const end = at + needle.length;
      const before = at === 0 || !/[a-z0-9_-]/i.test(body[at - 1]);
      const after = end >= body.length || !/[a-z0-9_-]/i.test(body[end]);
      if (before && after) return true;
      at = body.indexOf(needle, at + 1);
    }
    return false;
  }
  private playMentionSound() {
    if (!this.mentionSound) return;
    try {
      const AudioContextType = window.AudioContext;
      if (!AudioContextType) return;
      const context = new AudioContextType();
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(1174, context.currentTime + 0.09);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.10, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.23);
      oscillator.onended = () => { void context.close(); };
    } catch { /* audio may be unavailable or blocked */ }
  }
  stop() {
    this.session = null; this.on = false;
    this.close(); this.closeTextChat();
    for (const l of this.lines.values()) l.el.remove();
    this.lines.clear();
    for (const timers of this.messageTimers.values()) {
      clearTimeout(timers.fade);
    }
    this.messageTimers.clear(); this.chatSentAt = []; this.lastRateNoticeAt = -Infinity;
    this.chatMessages.replaceChildren(); this.historyButton.hidden = true; this.followingChat = true;
    this.chatFilter = 'all'; this.chatSearch = ''; this.searchInput.value = '';
    this.hideMentionSuggestions();
    this.mutedPanel.hidden = true; this.updateChatToolStates();
    this.chatHud.classList.remove('active', 'search-open');
    this.searchButton.setAttribute('aria-expanded', 'false');
    this.chatHud.dataset.gameReady = 'false';
    this.chatHud.hidden = true;
    this.externalChatLines = [];
    this.externalChatReady = false;
    this.postExternalChatSnapshot();
  }

  private updateHudVisibility() {
    const ready = !!this.session && this.freeRoamDriving();
    this.chatHud.dataset.gameReady = String(ready);
    this.chatHud.hidden = !ready;
    if (ready !== this.externalChatReady) {
      this.externalChatReady = ready;
      this.postExternalChatSnapshot();
    }
    if (!ready && this.chatHud.classList.contains('active')) this.closeTextChat();
  }

  private postExternalChatSnapshot() {
    this.externalChatBus?.postMessage({
      type: 'snapshot', connected: this.externalChatReady,
      messages: this.externalChatLines, channels: this.crews.map(crew => ({ id: crew.id, name: crew.name })),
    });
  }

  private publishExternalChatLine(line: ExternalChatLine) {
    this.externalChatLines.push(line);
    if (this.externalChatLines.length > CHAT_HISTORY_LIMIT) this.externalChatLines.splice(0, this.externalChatLines.length - CHAT_HISTORY_LIMIT);
    this.externalChatBus?.postMessage({ type: 'message', message: line });
  }

  private handleExternalChatMessage(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const event = value as { type?: unknown; text?: unknown; channel?: unknown };
    if (event.type === 'hello') { this.postExternalChatSnapshot(); return; }
    if (event.type !== 'send' || typeof event.text !== 'string' || typeof event.channel !== 'string') return;
    const clean = event.text.trim();
    if (!clean || Array.from(clean).length > 160) return;
    if (!this.session || !this.freeRoamDriving()) {
      this.externalChatBus?.postMessage({ type: 'send-result', ok: false, message: 'Sohbet için çevrimiçi serbest dolaşımda olmalısın.' });
      return;
    }
    let target: { scope: 'room' | 'crew'; id: number; label: string };
    if (event.channel === 'room') target = { scope: 'room', id: 0, label: t('All') };
    else if (event.channel === 'crew') {
      const crew = this.crews[this.channelIndex - 1] ?? this.crews[0];
      if (!crew) {
        this.externalChatBus?.postMessage({ type: 'send-result', ok: false, message: 'Ekip sohbeti için önce bir ekip oluşturmalısın.' });
        return;
      }
      target = { scope: 'crew', id: crew.id, label: crew.name };
    } else {
      this.externalChatBus?.postMessage({ type: 'send-result', ok: false, message: 'OOC kanalı mevcut Rust sohbet protokolünde henüz desteklenmiyor.' });
      return;
    }
    const sent = this.transmit(clean, target);
    this.externalChatBus?.postMessage({ type: 'send-result', ok: sent, message: sent ? 'Mesaj Rust sohbet servisine gönderildi.' : 'Mesaj gönderilemedi; kanal bağlantısını kontrol et.' });
  }

  /** the picker's place: the notices' (shell.ts placeNotices), u: CSS px per HUD unit */
  place(left: number, top: number, u: number) {
    this.updateHudVisibility();
    const s = this.picker.style;
    s.left = `${left}px`; s.top = `${top}px`;
    s.setProperty('--u', `${u}px`);
    this.layer.style.setProperty('--u', `${u}px`);
    // The racing HUD is positioned at 40px from the stage edges by its stylesheet.
  }

  /** active FreeRoam driving, independent of whether fixed-phrase Quick Chat is enabled */
  private readGameStatus() {
    const s = this.session, now = performance.now();
    if (!s) return;
    if (now - this.driveAt > 100) {
      this.driveAt = now;
      const st = s.status?.read();
      if (st) {
        this.drive = st.get('drive') ?? 0;
        this.netrace = st.get('netrace') ?? 0;
      }
    }
  }
  private freeRoamDriving(): boolean {
    if (!this.session) return false;
    this.readGameStatus();
    return (this.drive & 3) === 2 && (this.drive & 8) === 0;
  }
  private racing(): boolean {
    if (!this.session) return false;
    this.readGameStatus();
    return this.on && this.netrace > 0;
  }
  /** fixed-phrase picker is additionally gated by its setting */
  private driving(): boolean { return this.on && this.freeRoamDriving(); }
  private canPick(): boolean { return this.driving() || this.racing(); }

  private currentChannel(): { scope: 'room' | 'crew'; id: number; label: string } {
    const crew = this.crews[this.channelIndex - 1];
    return crew ? { scope: 'crew', id: crew.id, label: crew.name } : { scope: 'room', id: 0, label: t('All') };
  }
  private updateChannel() {
    const c = this.currentChannel();
    this.channelButton.textContent = c.scope === 'room' ? '[HERKES]' : `[${c.label}]`;
    this.channelButton.dataset.scope = c.scope;
    this.channelButton.title = c.scope === 'crew' ? c.label : t('Tab to switch channel');
    for (const button of this.chatHud.querySelectorAll<HTMLButtonElement>('[data-chat-channel]')) {
      const active = button.dataset.chatChannel === c.scope;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  private cycleChannel() { this.channelIndex = (this.channelIndex + 1) % (this.crews.length + 1); this.updateChannel(); }
  private openTextChat(): boolean {
    const s = this.session;
    if (!s?.net?.chat || !this.freeRoamDriving()) return false;
    this.updateHudVisibility();
    this.close(); this.chatHud.classList.remove('search-open'); this.searchButton.setAttribute('aria-expanded', 'false'); this.chatHud.classList.add('active');
    this.updateChannel(); this.holdMessageFade(); this.scrollChatToLatest(); this.deps.place(); this.chatInput.focus();
    return true;
  }
  private closeTextChat() {
    if (!this.chatHud.classList.contains('active')) return;
    this.hideMentionSuggestions();
    this.chatHud.classList.remove('active', 'search-open');
    this.searchButton.setAttribute('aria-expanded', 'false');
    if (document.activeElement === this.chatInput) this.chatInput.blur();
    this.resumeMessageFade();
  }
  /** milliseconds until the hub's rolling 4-per-5-second allowance has a free slot */
  private chatWaitMs(now = performance.now()): number {
    this.chatSentAt = this.chatSentAt.filter(at => now - at < CHAT_RATE_WINDOW_MS);
    return this.chatSentAt.length < CHAT_RATE_MAX
      ? 0
      : Math.max(0, this.chatSentAt[0] + CHAT_RATE_WINDOW_MS - now);
  }
  private trimChatHistory() {
    while (this.chatMessages.childElementCount > CHAT_HISTORY_LIMIT) {
      const oldest = this.chatMessages.firstElementChild as HTMLElement | null;
      if (!oldest) break;
      const timers = this.messageTimers.get(oldest);
      if (timers) {
        clearTimeout(timers.fade);
      }
      this.messageTimers.delete(oldest);
      oldest.remove();
    }
  }
  /** Is the reader at the newest line (within a small tolerance for touchpad precision)? */
  private isChatAtLatest(): boolean {
    return this.chatMessages.scrollHeight - this.chatMessages.clientHeight - this.chatMessages.scrollTop <= 28;
  }
  private scrollChatToLatest(smooth = false) {
    this.chatMessages.scrollTo({ top: this.chatMessages.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    this.followingChat = true;
    this.historyButton.hidden = true;
  }
  private updateChatScrollState() {
    if (this.isChatAtLatest()) {
      this.followingChat = true;
      this.historyButton.hidden = true;
    } else {
      this.followingChat = false;
    }
  }
  private appendHistoryRow(row: HTMLElement) {
    const active = this.chatHud.classList.contains('active');
    const shouldFollow = !active || this.followingChat || this.isChatAtLatest();
    this.chatMessages.append(row);
    this.trimChatHistory();
    this.applyChatView();
    if (shouldFollow) this.scrollChatToLatest();
    else this.historyButton.hidden = false;
    if (!active) this.startMessageFade(row);
  }
  private timestampElement(): HTMLTimeElement {
    const now = new Date();
    const stamp = document.createElement('time');
    stamp.className = 'chat-timestamp';
    stamp.dateTime = now.toISOString();
    stamp.textContent = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(now);
    return stamp;
  }

  private systemMessage(message: string) {
    const row = document.createElement('div');
    row.className = 'message system';
    row.dataset.scope = 'system';
    row.dataset.search = message.toLocaleLowerCase();
    const marker = document.createElement('span'); marker.className = 'channel'; marker.textContent = '!';
    const text = document.createElement('span'); text.className = 'text'; text.textContent = message;
    row.append(marker, text, this.timestampElement());
    this.appendHistoryRow(row);
    const timestamp = Date.now();
    this.publishExternalChatLine({
      id: `system-${timestamp}`, channel: 'SİSTEM', user: 'TRPOLARIS SYSTEM', msg: message,
      time: new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(timestamp), timestamp,
    });
  }
  private transmit(text: string, channelOverride?: { scope: 'room' | 'crew'; id: number; label: string }): boolean {
    const s = this.session, clean = text.trim(), channel = channelOverride ?? this.currentChannel();
    if (!s?.net?.chat || !clean) return false;
    if (hasChatProfanity(clean)) {
      this.systemMessage(t(N('Message blocked by chat filter')));
      this.deps.log('[chat] message blocked by the profanity filter');
      return false;
    }
    const now = performance.now(), wait = this.chatWaitMs(now);
    if (wait > 0) {
      const seconds = Math.max(1, Math.ceil(wait / 1000));
      if (now - this.lastRateNoticeAt >= 900) {
        this.systemMessage(`${t('Wait a moment')} (${seconds}s)`);
        this.lastRateNoticeAt = now;
      }
      this.deps.log(`[chat] rate limited locally; retry in ${seconds}s`);
      return false;
    }
    if (!s.net.chat(clean, channel.scope, channel.id)) {
      this.deps.log('[chat] message not sent: FreeRoam connection or Crew membership');
      return false;
    }
    this.chatSentAt.push(now);
    return true;
  }

  /** Refresh the server-backed player cache only while typed chat is in use. */
  private async loadMentionPlayers() {
    if (Date.now() - this.mentionPlayersFetchedAt < 5000) return;
    if (this.mentionPlayersRequest) return this.mentionPlayersRequest;
    this.mentionPlayersRequest = (async () => {
      try {
        const response = await fetch('/api/v1/live/players', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`player list HTTP ${response.status}`);
        const payload = await response.json() as { players?: unknown };
        const rows = Array.isArray(payload.players) ? payload.players : [];
        const seen = new Set<string>();
        this.mentionPlayers = rows.flatMap(row => {
          if (!row || typeof row !== 'object') return [];
          const item = row as Record<string, unknown>;
          const name = typeof item.name === 'string' ? item.name.trim().slice(0, 32) : '';
          const key = normalizedPlayerName(name);
          if (!name || !key || seen.has(key) || key === normalizedPlayerName(this.playerName)) return [];
          seen.add(key);
          return [{ name, activity: typeof item.activity === 'string' ? item.activity : 'menus' }];
        });
      } catch (error) {
        this.mentionPlayers = [];
        this.deps.log(`[chat] live player suggestions unavailable: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.mentionPlayersFetchedAt = Date.now();
    })();
    try { await this.mentionPlayersRequest; }
    finally { this.mentionPlayersRequest = null; }
  }

  private mentionAtCaret(): { start: number; end: number; query: string } | null {
    const caret = this.chatInput.selectionStart ?? this.chatInput.value.length;
    const before = this.chatInput.value.slice(0, caret);
    const match = /(?:^|\s)@([^\s@]*)$/u.exec(before);
    if (!match) return null;
    return {
      start: caret - match[0].length + match[0].lastIndexOf('@'),
      end: caret,
      query: match[1],
    };
  }

  private async updateMentionSuggestions() {
    if (!this.chatHud.classList.contains('active') || document.activeElement !== this.chatInput) {
      this.hideMentionSuggestions();
      return;
    }
    const requested = this.mentionAtCaret();
    if (!requested) { this.hideMentionSuggestions(); return; }
    await this.loadMentionPlayers();
    const current = this.mentionAtCaret();
    if (!current || current.start !== requested.start || current.query !== requested.query ||
        document.activeElement !== this.chatInput || !this.chatHud.classList.contains('active')) return;
    const query = normalizedPlayerName(current.query);
    const priority: Record<string, number> = { 'free-roam': 0, online: 1, menus: 2, lan: 3 };
    const matches = this.mentionPlayers
      .filter(player => normalizedPlayerName(player.name).includes(query))
      .sort((a, b) => (priority[a.activity] ?? 4) - (priority[b.activity] ?? 4) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .slice(0, 8);
    if (!matches.length) { this.hideMentionSuggestions(); return; }
    this.mentionRange = { start: current.start, end: current.end };
    this.mentionResults = matches;
    this.mentionIndex = 0;
    this.renderMentionSuggestions();
  }

  private renderMentionSuggestions() {
    this.mentionSuggestions.replaceChildren();
    const turkish = language() === 'turkish';
    this.mentionResults.forEach((player, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'chat-mention-option';
      option.dataset.mentionIndex = String(index);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === this.mentionIndex));
      const name = document.createElement('span');
      name.className = 'chat-mention-name';
      name.textContent = `@${player.name}`;
      const activity = document.createElement('small');
      activity.className = 'chat-mention-activity';
      activity.textContent = player.activity === 'free-roam' ? (turkish ? 'SERBEST DOLAŞIM' : 'FREE ROAM')
        : player.activity === 'online' ? (turkish ? 'ÇEVRİMİÇİ' : 'ONLINE')
        : player.activity === 'lan' ? 'LAN' : (turkish ? 'MENÜDE' : 'MENUS');
      option.append(name, activity);
      this.mentionSuggestions.append(option);
    });
    this.mentionSuggestions.hidden = false;
    this.chatInput.setAttribute('aria-expanded', 'true');
  }

  private moveMentionSelection(delta: number) {
    if (!this.mentionResults.length) return;
    this.mentionIndex = (this.mentionIndex + delta + this.mentionResults.length) % this.mentionResults.length;
    for (const [index, option] of [...this.mentionSuggestions.querySelectorAll<HTMLButtonElement>('[data-mention-index]')].entries()) {
      option.setAttribute('aria-selected', String(index === this.mentionIndex));
    }
  }

  private chooseMention(index: number): boolean {
    const player = this.mentionResults[index];
    const range = this.mentionRange;
    if (!player || !range) { this.hideMentionSuggestions(); return false; }
    const before = this.chatInput.value.slice(0, range.start);
    const after = this.chatInput.value.slice(range.end);
    const suffix = after.startsWith(' ') || after.startsWith('\n') ? '' : ' ';
    const insertion = `@${player.name}${suffix}`;
    this.chatInput.value = before + insertion + after;
    const caret = before.length + insertion.length;
    this.chatInput.setSelectionRange(caret, caret);
    this.hideMentionSuggestions();
    this.chatInput.focus();
    return true;
  }

  private hideMentionSuggestions() {
    this.mentionRange = null;
    this.mentionResults = [];
    this.mentionIndex = 0;
    if (this.mentionSuggestions) this.mentionSuggestions.hidden = true;
    this.chatInput?.setAttribute('aria-expanded', 'false');
  }

  private sendText() {
    const text = this.chatInput.value.trim();
    if (!text) { this.closeTextChat(); return; }
    if (this.transmit(text)) {
      this.chatInput.value = '';
      this.closeTextChat();
    }
  }
  private sendQuick(text: string) { if (this.transmit(text)) this.closeTextChat(); }
  private holdMessageFade() {
    for (const [el, timers] of this.messageTimers) {
      clearTimeout(timers.fade);
      el.classList.remove('fade-out');
    }
    this.messageTimers.clear();
  }
  private startMessageFade(el: HTMLElement) {
    const old = this.messageTimers.get(el);
    if (old) clearTimeout(old.fade);
    const fade = window.setTimeout(() => {
      if (this.chatHud.classList.contains('active')) return;
      el.classList.add('fade-out');
      // Keep the node in the bounded history; opening chat removes this class and exposes it again.
      this.messageTimers.set(el, { fade });
    }, CHAT_MESSAGE_MS);
    this.messageTimers.set(el, { fade });
  }
  private resumeMessageFade() { for (const el of this.chatMessages.children) this.startMessageFade(el as HTMLElement); }

  private key(e: KeyboardEvent) {
    if (!this.session || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    // Let editable controls own Y; the shortcut only closes chat when focus is outside text entry.
    if (e.code === 'KeyY' && !e.repeat && this.chatHud.classList.contains('active')
        && !el?.closest?.('input, textarea, select, [contenteditable="true"]')) {
      e.preventDefault(); e.stopImmediatePropagation(); this.closeTextChat(); return;
    }
    if (this.chatHud.classList.contains('active')) {
      if (el === this.chatInput && !this.mentionSuggestions.hidden) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); e.stopImmediatePropagation();
          this.moveMentionSelection(e.key === 'ArrowDown' ? 1 : -1);
          return;
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.repeat) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (this.chooseMention(this.mentionIndex)) return;
        }
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopImmediatePropagation();
          this.hideMentionSuggestions();
          return;
        }
      }
      if (el && (this.chatTools.contains(el) || this.mutedPanel.contains(el) || this.chatMessages.contains(el)) && el !== this.chatInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (!this.mutedPanel.hidden) this.mutedPanel.hidden = true;
          else if (!this.chatHud.classList.contains('search-open')) this.closeTextChat();
          else {
            this.chatHud.classList.remove('search-open');
            this.searchButton.setAttribute('aria-expanded', 'false');
            this.searchButton.focus();
          }
        }
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!this.mutedPanel.hidden) { this.mutedPanel.hidden = true; this.updateChatToolStates(); }
        else this.closeTextChat();
      } else if (e.key === 'Tab' && el === this.chatInput) {
        e.preventDefault(); e.stopImmediatePropagation(); this.cycleChannel();
      } else if (e.key === 'Enter' && el === this.chatInput && !e.repeat) {
        e.preventDefault(); e.stopImmediatePropagation(); this.sendText();
      }
      return;
    }
    if (el?.closest?.('input, textarea, select, dialog[open]') || document.querySelector('dialog[open]')) return;
    if (e.code === 'KeyY' && !e.repeat) {
      if (this.openTextChat()) { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    const k = KEYS[e.code];
    if (k === undefined && !(e.code === 'Escape' && this.open >= 0)) return;
    if (!this.canPick()) { if (this.open >= 0) this.close(); return; }
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); }
    if (e.repeat) return;
    if (e.code === 'Escape') this.close();
    else if (this.open < 0 || this.open === 4 || this.mode !== 'keys') this.group(k, 'keys');
    else this.pick(this.open * 4 + k);
  }

  /** the right stick, every time the controller is read (gamepad.ts PadPage.stick); true: the picker has it */
  stick(x: number, y: number): boolean {
    const r = Math.hypot(x, y), mine = this.open >= 0 && this.mode === 'pad';
    if (r < REST) { this.armed = true; return mine; }
    if (r < FLICK || !this.armed) return mine;
    this.armed = false;
    if (!this.canPick()) return false;
    const dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 1 : 3) : (y < 0 ? 0 : 2);
    if (!mine) this.group(dir, 'pad');
    else this.pick(this.open * 4 + dir);
    return true;
  }

  /** The on-screen Chat control opens the same composer as the Y shortcut. */
  toggle() {
    if (this.chatHud.classList.contains('active')) { this.closeTextChat(); return; }
    if (this.racing()) {
      if (this.open === 4) this.close();
      else this.group(4, 'keys');
      return;
    }
    if (!this.freeRoamDriving()) return;
    this.openTextChat();
  }

  /** Open the text composer from the F9 control menu without bypassing FreeRoam checks. */
  openChat(): boolean { return this.openTextChat(); }

  private group(g: number, mode: Mode) {
    this.mode = mode; this.open = g;
    this.draw();
  }

  private close() {
    clearTimeout(this.closeTimer);
    this.open = -1;
    this.picker.hidden = true;
    this.picker.replaceChildren();
  }

  /** at most BURST in WINDOW_MS: the time until the next may go (0: now) */
  private wait(now: number): number {
    this.sent = this.sent.filter(at => now - at < WINDOW_MS);
    return this.sent.length < BURST ? 0 : this.sent[0] + WINDOW_MS - now;
  }

  /** the slot picked (group * 4 + place): says the phrase the player put there */
  private pick(slot: number) {
    const s = this.session, now = performance.now(), p = this.layout[slot];
    if (!s || p === undefined || !PHRASES[p]) return;
    if (this.wait(now) > 0) { this.draw(); return; }
    const race = this.racing() && !this.freeRoamDriving();
    if (!s.net?.say?.(p, race)) { this.close(); return; }
    this.sent.push(now);
    this.deps.log(`[chat] said ${p} (${PHRASES[p].text})${race ? ', in the race' : ''}`);
    this.close();
  }

  /** a slot's phrase in the page's language */
  private text(slot: number): string { return t(PHRASES[this.layout[slot]]?.text ?? ''); }

  private draw() {
    clearTimeout(this.closeTimer);
    const p = this.picker, wait = this.wait(performance.now());
    this.deps.place();
    p.dataset.mode = this.mode;
    p.hidden = false;
    const kids: HTMLElement[] = [];
    const el = (tag: string, cls: string, text?: string) => {
      const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e;
    };
    if (wait > 0) {
      kids.push(el('div', 'qc-title', t('Quick chat')), el('div', 'qc-wait', t('Wait a moment')));
      this.closeTimer = window.setTimeout(() => this.close(), Math.min(wait, PICK_MS));
    } else if (this.open === 4) {
      for (let g = 0; g < 4; g++) {
        const col = el('div', 'qc-group');
        col.append(el('div', 'qc-title', t(catName(this.groups[g]))));
        for (let i = 0; i < 4; i++) {
          const b = el('button', 'qc-say', this.text(g * 4 + i)) as HTMLButtonElement;
          b.type = 'button'; b.dataset.slot = String(g * 4 + i);
          col.append(b);
        }
        kids.push(col);
      }
      if (this.session?.net?.chat && this.freeRoamDriving()) {
        const b = el('button', 'qc-say', t('Type a FreeRoam message')) as HTMLButtonElement;
        b.type = 'button'; b.dataset.chatText = '1'; kids.push(b);
      }
    } else {
      kids.push(el('div', 'qc-title', t(catName(this.groups[this.open]))));
      for (let i = 0; i < 4; i++) {
        const row = el('div', 'qc-row');
        row.dataset.slot = String(this.open * 4 + i);
        row.append(el('kbd', '', this.mode === 'pad' ? ARROWS[i] : String(i + 1)), el('span', 'qc-text', this.text(this.open * 4 + i)));
        kids.push(row);
      }
      if (this.mode === 'keys') kids.push(el('div', 'qc-foot', t('Esc closes')));
      this.closeTimer = window.setTimeout(() => this.close(), PICK_MS);
    }
    p.replaceChildren(...kids);
  }

  /** a phrase said (roam_game.c say_page, NET_KIND_SAY): its line over the car, the log, the lobby's card */
  said(json: string) {
    let s: Said;
    try { s = JSON.parse(json) as Said; } catch { this.deps.log(`[chat] not JSON: ${json.slice(0, 80)}`); return; }
    if (!this.on || typeof s.id !== 'number' || typeof s.p !== 'number' || !(s.p >= 0 && s.p < PHRASES.length)) return;
    const text = t(PHRASES[s.p].text), me = !!s.me, name = String(s.name ?? '');
    if (s.race && !me && this.blocked.has(normalizedPlayerName(name))) {
      this.deps.log(`[chat] ${name} said ${s.p}, in the race: not shown (blocked)`);
      return;
    }
    this.deps.log(`[chat] ${me ? 'you' : name} said ${s.p} (${PHRASES[s.p].text})${s.race ? ', in the race' : s.lobby ? ', in our lobby' : ''}`);
    if (s.race) { this.deps.line(name, text, me); return; }
    this.lines.get(s.id)?.el.remove();
    // the place on .qc-line (every frame), the look and its pop on .qc-b
    const el = document.createElement('div'), b = document.createElement('div');
    el.className = 'qc-line' + (me ? ' me' : '');
    b.className = 'qc-b';
    b.innerHTML = ICON;
    b.append(Object.assign(document.createElement('span'), { textContent: text }));
    el.append(b);
    el.hidden = true;
    this.layer.append(el);
    this.lines.set(s.id, { el, until: performance.now() + SHOW_MS, me, shown: false, out: false });
    this.deps.line(name, text, me);
    this.deps.lobby(name, text);
  }

  /** Server-relayed room/Crew line; receiver membership was already checked by the hub. */
  chat(json: string) {
    let raw: unknown;
    try { raw = JSON.parse(json); } catch { this.deps.log('[chat] invalid server message'); return; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { this.deps.log('[chat] invalid server message'); return; }
    const s = raw as TypedChat;
    if (!this.session || !Number.isSafeInteger(s.id) || s.id <= 0 || typeof s.name !== 'string' || typeof s.text !== 'string'
        || (s.scope !== 'room' && s.scope !== 'crew') || !Number.isSafeInteger(s.channel) || s.channel < 0 || s.channel > 0xffffffff) return;
    const name = s.name.trim(), body = s.text.trim();
    if (!name || Array.from(name).length > 32 || /[\u0000-\u001f\u007f]/.test(name)
        || !body || Array.from(body).length > 160 || new TextEncoder().encode(body).length > 512
        || /[\u0000-\u001f\u007f]/.test(body)) return;
    const crew = s.scope === 'crew' ? this.crews.find(c => c.id === s.channel) : undefined;
    if (s.scope === 'crew' && (!crew || s.channel === 0)) return;
    if (s.scope === 'room' && s.channel !== 0) return;
    const label = crew?.name ?? t('All');
    const quickMessage = QUICK_CHAT.some(item => item.text === body);
    const mine = s.me === true;
    const mentioned = !mine && this.isMention(body);
    const row = document.createElement('div');
    row.className = `message ${quickMessage ? 'quick' : s.scope === 'crew' ? 'team' : 'all'}${mine ? ' me' : ''}${mentioned ? ' mention' : ''}`;
    row.dataset.scope = s.scope;
    row.dataset.senderId = String(s.id);
    row.dataset.senderName = name;
    row.dataset.search = `${name} ${body} ${label}`.normalize('NFKC').toLocaleLowerCase();
    row.style.setProperty('--chat-sender-color', mine ? '#00ffcc' : stableSenderColor(name));
    if (mine) row.dataset.self = 'true';
    const channel = document.createElement('span'); channel.className = 'channel';
    channel.textContent = quickMessage ? '⚡' : s.scope === 'crew' ? `[${label}]` : '[HERKES]';
    channel.title = label;
    const sender = document.createElement('span'); sender.className = 'sender';
    sender.textContent = `${name}:`; sender.title = name;
    const text = document.createElement('span'); text.className = 'text';
    const mentionNeedle = this.playerName ? `@${normalizedPlayerName(this.playerName)}` : '';
    const mentionAt = mentioned ? body.normalize('NFKC').toLocaleLowerCase().indexOf(mentionNeedle) : -1;
    if (mentionAt >= 0) {
      text.append(document.createTextNode(body.slice(0, mentionAt)));
      const tag = document.createElement('mark'); tag.className = 'chat-mention'; tag.textContent = body.slice(mentionAt, mentionAt + mentionNeedle.length);
      text.append(tag, document.createTextNode(body.slice(mentionAt + mentionNeedle.length)));
    } else text.textContent = body;
    const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'chat-mute';
    mute.dataset.chatMute = name; mute.textContent = '−';
    mute.title = t('Mute player'); mute.setAttribute('aria-label', t('Mute player'));
    row.setAttribute('aria-label', `${label}, ${name}: ${body}`);
    row.dataset.messageId = String(s.id);
    row.append(channel, sender, text, this.timestampElement(), mute);
    // Retain the most recent 200 room/Crew lines; preserve the reader's position when they are browsing history.
    this.appendHistoryRow(row);
    const timestamp = Date.now();
    this.publishExternalChatLine({
      id: String(s.id), channel: s.scope === 'crew' ? 'EKİP' : 'GENEL', user: name, msg: body,
      time: new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(timestamp), timestamp,
    });
    if (mentioned && !this.mutedPlayers.has(normalizedPlayerName(name))) this.playMentionSound();
    this.deps.log(`[chat] ${s.scope === 'crew' ? 'Crew ' + label : 'FreeRoam'}: ${name}: ${body}`);
  }

  /** every frame drawn (the renderer's onMarks): also gates HUD visibility on actual FreeRoam driving */
  marks(n: number, m: Float32Array, ids: Uint32Array) {
    this.updateHudVisibility();
    if (!this.lines.size) return;
    const s = this.session, now = performance.now();
    const v = s?.viewRect();
    for (const [id, l] of this.lines) {
      if (now >= l.until) { l.el.remove(); this.lines.delete(id); continue; }
      let i = 0;
      while (i < n && ids[4 * i] !== id) i++;
      const show = i < n && !!v && v.w > 0 && v.h > 0;
      if (show) {
        // its bottom middle on the name's top (the game's point is the name's middle), scaled with the name
        const u = Math.min(v.w / 640, v.h / 480), sc = m[4 * i + 3], ls = Math.max(sc, LINE_MIN);
        const x = v.x + m[4 * i + 1] * v.w, y = v.y + m[4 * i + 2] * v.h - (l.me ? 0 : NAME_H / 2 * u * sc);
        l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${ls.toFixed(3)}) translate(-50%, -100%)`;
      }
      if (show !== l.shown) { l.el.hidden = !show; l.shown = show; }
      if (!l.out && now >= l.until - FADE_MS) { l.out = true; l.el.classList.add('out'); }
    }
  }

  /** for the page's test hooks */
  state() { return { on: this.on, open: this.open, mode: this.mode, lines: [...this.lines.keys()], sent: this.sent.length,
    chatOpen: this.chatHud.classList.contains('active'), channel: this.currentChannel(), messages: this.chatMessages.childElementCount,
    netrace: this.netrace }; }
}
