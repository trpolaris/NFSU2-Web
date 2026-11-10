// Settings configuration and persistence service. This module owns settings.ini semantics only; it has no DOM surface.
import { checkSetting, DEFAULTS, keyDef, resolveEnv, settingsPut, TEMPLATE, type Resolved } from './settings';
import { SettingsFile } from './settings-store';
import { playHorn, stopHorn } from './horn-preview';
import { CREW_MAX, checkCrew, crewsOf, crewsValue, freeColour, rgbsValue, type Crew } from './crews';
import { onlineName } from './claim';
import { DEFAULT_GROUPS, DEFAULT_PHRASES, groupsOf, PHRASES, phrasesOf, SLOTS } from './phrases';
import { LANGUAGES, N, NATIVE, t, tn, tvars, type Language, type Msg } from './i18n';
import { SITE_KEYS } from './sitekeys';


/** Safe, allow-listed keys used by portable launcher profiles; never export unknown settings.ini lines. */
export const PROFILE_SETTING_KEYS = ['render', 'fps', 'audio_latency', 'language', 'subtitles', 'sound', 'intro', 'gamepad', 'rumble', 'ui_textures', 'open_tunnel', 'show_hidden_races', 'catchup', 'license_plate'] as const;
const PROFILE_SETTING_SET = new Set<string>(PROFILE_SETTING_KEYS);

type Control =
  /** inv: on when the key is off (Ghost mode is roam_collide = off) */
  | { t: 'switch'; inv?: boolean }
  | { t: 'seg'; opts: [value: string, label: string][] }
  /** a choice of more than a row of buttons holds: a drop-down list; preview: a Listen button beside it plays the
   *  value chosen (the promise ends when it has played), stop ends that early */
  | { t: 'select'; opts: [value: string, label: string][]; preview?: { play(value: string): Promise<void>; stop(): void } }
  | { t: 'num'; min?: number; max?: number; step?: number; unit?: string }
  | { t: 'text'; placeholder?: string }
  /** the crews (crews.ts): a line per crew with Leave, and a box with Join for one more */
  | { t: 'crews'; placeholder: string }
  /** quick chat's sixteen (phrases.ts): under "Choose phrases", four columns of a name and four phrases, each a
   *  drop-down list */
  | { t: 'phrases' };

/** link: the words of help that link to a page (a mod's, say), opened in a new tab */
interface Item { key: string; label: string; help: string; link?: { text: string; href: string }; c: Control; more?: boolean }
/** status: the group shows a line of the page's own under its title (Online: who plays on this server now);
 *  own: the group is a section of the page of its own (#online, under Saves), named by that section's heading;
 *  more: the title of its "more" part.  The texts are English (N), translated where they are drawn. */
interface Group { title: string; more: string; items: Item[]; status?: boolean; own?: boolean }

/** each language's name in English (translated where it is shown), beside its own name */
const LANGUAGE_NAMES: Record<Language, string> = {
  english: N('English'), french: N('French'), german: N('German'), italian: N('Italian'), spanish: N('Spanish'), dutch: N('Dutch'),
  swedish: N('Swedish'), danish: N('Danish'), korean: N('Korean'), chinese: N('Chinese'), japanese: N('Japanese'), russian: N('Russian'),
  thai: N('Thai'), portuguese: N('Portuguese (Brazil)'), polish: N('Polish'), turkish: N('Turkish'),
};
const LANGUAGE_OPTS = LANGUAGES.map(l => [l, LANGUAGE_NAMES[l]] as [string, string]);

const GROUPS: Group[] = [
  { title: N('Online'), more: N('More online settings'), status: true, own: true, items: [
    { key: 'roam', label: N('Free roam with others'), help: N('Everyone on this server who turns this on sees your car in career free roam, and you see theirs, with their names over them.'), c: { t: 'switch' } },
    { key: 'roam_name', label: N('Your name'), help: N('What other players see over your car in free roam and in the Online menu: 3 to 15 letters, digits, - or _. Empty uses your profile name.'), c: { t: 'text', placeholder: N('profile name') } },
    { key: 'license_plate', label: N('License plate'), help: N('On your car, also for other players in free roam: up to 8 letters and digits.'), c: { t: 'text', placeholder: N('Original plate') } },
    { key: 'roam_crew', label: N('Crews'), help: N('Friends who type the same crew name always see each other in free roam, however far apart, with names and map arrows in the crew\'s colour. Up to 4 crews. Anyone who types the name joins.'), c: { t: 'crews', placeholder: N('Crew name') } },
    { key: 'horn', label: N('Your horn'), help: N('N or the controller\'s left stick click, in free roam and in races with other players.'), c: { t: 'select', opts: [
      ['dual', N('Dual tone')], ['single', N('Single tone')], ['truck', N('Air horn')], ['train', N('Train horn')], ['klaxon', N('Klaxon')],
      ['cucaracha', N('La Cucaracha')], ['clown', N('Clown horn')], ['trombone', N('Sad trombone')]], preview: { play: playHorn, stop: stopHorn } } },
    { key: 'roam_room', label: N('Room'), help: N('Leave empty to drive with everyone. With a name, free roam shows only the players who set the same name. Not private: everyone on this server still sees your name.'), c: { t: 'text', placeholder: N('everyone') } },
    { key: 'roam_block', label: N('Blocked players'), help: N('Names over cars, separated by commas: you and they never see each other in free roam. The server\'s operator sees who blocks whom.'), c: { t: 'text', placeholder: N('nobody') }, more: true },
    { key: 'roam_collide', label: N('Ghost mode'), help: N('You drive through the other players\' cars, and they through yours. Off: you collide with them, and a car that appears on yours lets you through until you are apart.'), c: { t: 'switch', inv: true } },
    { key: 'quick_chat', label: N('Quick chat'), help: N('Say one of your sixteen phrases to the players near you in free roam: 1 to 4, then 1 to 4 (on a controller, the right stick twice; on a touch screen, the chat button). Theirs show over their cars.'), c: { t: 'switch' } },
    { key: 'quick_chat_phrases', label: N('Your phrases'), help: N('Which sixteen quick chat has, in four groups of four. Everyone reads what you say in their own language.'), c: { t: 'phrases' } },
    { key: 'online', label: N('Online mode'), help: N('The game\'s Online menu takes you straight to the Online Main Menu under your name, without the EA Login screens: lobby, chat and races with everyone playing from this server.'), c: { t: 'switch' }, more: true },
    { key: 'roam_max_cars', label: N('Players\' cars shown'), help: N('The nearest. Phones start at 16 and tablets at 24: many cars loading at once can take more memory than they have.'), c: { t: 'seg', opts: [['16', '16'], ['20', '20'], ['24', '24'], ['28', '28'], ['32', '32']] }, more: true },
  ] },
  { title: N('Game'), more: N('More game settings'), items: [
    { key: 'language', label: N('Language'), help: N('The game\'s menus and subtitles, the voices in languages with a dub, and this page.'), c: { t: 'select', opts: LANGUAGE_OPTS } },
    { key: 'movies', label: N('Movies'), help: N('Intro, story and FMV movies.'), c: { t: 'switch' } },
    { key: 'subtitles', label: N('Subtitles'), help: N('The movies\' lines as text. English\'s are VileStuff\'s English Subtitles Fixed, with who says each line.'), link: { text: N('English Subtitles Fixed'), href: 'https://nfsmods.xyz/mod/5286' }, c: { t: 'switch' } },
    { key: 'autosave', label: N('Autosave'), help: N('Sets each profile\'s Save option in the game to Autosave once, so races, purchases and changes are saved without asking. Prompt or Off chosen afterwards in the game\'s Options, Gameplay stays.'), c: { t: 'switch' } },
    { key: 'gps_distance', label: N('GPS distance'), help: N('Shows a straight-line distance to your GPS destination beneath the arrow, using Speedometer Units. Hidden while GPS has no active route.'), c: { t: 'switch' }, more: true },
    { key: 'show_hidden_races', label: N('Show hidden races'), help: N('Shows the career races the game normally hides on the map. Changes only in-memory tables; does not write to career save files.'), c: { t: 'switch' }, more: true },
    { key: 'uniques', label: N('Unique parts for every car'), help: N('Once Caleb is beaten, the shops sell the unique visual parts, wide body kits too, for every car in your career. Off: as in the original, each one only for the car you earned it with.'), c: { t: 'switch' }, more: true },
    { key: 'catchup', label: N('Rubberbanding'), help: N('Career opponents ahead of you wait for you, ones behind get more power and grip. No boost: they still wait, but never beat their own pace. Off: neither, as Quick Race with Catch Up off.'), c: { t: 'seg', opts: [['original', N('Original')], ['noboost', N('No boost')], ['off', N('Off')]] }, more: true },
    { key: 'intro', label: N('Startup movies'), help: N('The EA and THX logos, the PSA and the intro. Skippable: Enter, Esc, Space, a left click, or A, B or Start ends each one. Original: as in the game, where only the intro ends early.'), c: { t: 'seg', opts: [['skippable', N('Skippable')], ['original', N('Original')], ['off', N('Off')]] }, more: true },
    { key: 'sound', label: N('Sound'), help: N('All sound output.'), c: { t: 'switch' }, more: true },
    { key: 'background', label: N('When the tab is in the background'), help: N('Pause freezes the game and its sound, as alt-tab does on Windows. In LAN and Online play it keeps running, without sound.'), c: { t: 'seg', opts: [['pause', N('Pause')], ['run', N('Keep running')]] }, more: true },
    { key: 'audio_latency', label: N('Output latency'), help: N('Lowest reacts fastest; Robust survives a busy PC best.'), c: { t: 'seg', opts: [['interactive', N('Lowest')], ['balanced', N('Balanced')], ['playback', N('Robust')]] }, more: true },
    { key: 'seed_registry', label: N('Highest graphics for a new save'), help: N('The game\'s own graphics options at their highest, at this screen\'s resolution. Off lets the game run its own hardware check.'), c: { t: 'switch' }, more: true },
  ] },
  { title: N('Mods'), more: N('More mod settings'), items: [
    { key: 'open_tunnel', label: N('Drive through the Construction Tunnel, including early in your career.'), help: N('Changes apply the next time you press Play.'), c: { t: 'switch' } },
    { key: 'mod_rims', label: N('Enable mod rim brands'), help: N('Adds compatible mod rim brands to Body Shop. Requires a compatible MODPACKS pack in the game folder. Off by default. Changes apply the next time you press Play.'), c: { t: 'switch' }, more: true },
  ] },
  { title: N('Display'), more: N('More display settings'), items: [
    { key: 'fullscreen', label: N('Full screen on Play'), help: N('Off plays in this browser window; the menu (F9) has full screen while you play. Hold Esc to leave it. On by default on phones.'), c: { t: 'switch' } },
    { key: 'render', label: N('Resolution scale'), help: N('Scales the game\'s screen-size resolution (its default), per side: 50% renders a quarter of the pixels. Lower is faster and softer. Phones start at 75%.'), c: { t: 'seg', opts: [['scale:0.5', '50%'], ['scale:0.75', '75%'], ['backing', '100%'], ['scale:1.5', '150%'], ['scale:2', '200%']] } },
    { key: 'fps', label: N('Frame rate'), help: N('Auto follows the display (120 on a 120 Hz screen, 240 on a 240 Hz one). 30 is steadier where 60 stutters, as on a slow phone, and easier on the battery. Online and LAN races run at up to 120, as on a PC; cutscenes stay at 30.'), c: { t: 'seg', opts: [['auto', N('Auto')], ['30', '30'], ['60', '60'], ['120', '120'], ['240', '240']] } },
    { key: 'ui_textures', label: N('Menus and HUD'), help: N('Original: the game\'s own. Upscaled: LunicAura106\'s Upscaled HUD mod, the menus, race HUD, fonts and logos redrawn at four times their size, sharp at high resolutions. About 5 MB to download, and on most phones four times the memory.'), link: { text: N('Upscaled HUD'), href: 'https://nfsmods.xyz/mod/4319' }, c: { t: 'seg', opts: [['original', N('Original')], ['uhud', N('Upscaled')]] }, more: true },
    { key: 'hud', label: N('Race HUD'), help: N('Wide anchors it to the screen edges; 4:3 is the original centred layout.'), c: { t: 'seg', opts: [['wide', N('Wide')], ['43', '4:3']] }, more: true },
    { key: 'movie_framing', label: N('Movie framing'), help: N('Fit keeps the 4:3 movies whole; fill crops them; stretch widens them.'), c: { t: 'seg', opts: [['fit', N('Fit')], ['fill', N('Fill')], ['stretch', N('Stretch')]] }, more: true },
    { key: 'cutscene_borders', label: N('Cutscene bars'), help: N('Letterbox bars across the whole width, or none.'), c: { t: 'seg', opts: [['full', N('Full')], ['off', N('Off')]] }, more: true },
    { key: 'other_headlights', label: N('Other cars\' headlights'), help: N('Light on the road from other cars, as your own headlights give. Players: friends in free roam and the other players in Online and LAN races. All: AI racers and traffic too. Off: only yours, as in the original game.'), c: { t: 'seg', opts: [['players', N('Players')], ['all', N('All cars')], ['off', N('Off')]] }, more: true },
    { key: 'fps_counter', label: N('Frame-rate counter'), help: N('In a corner of the game. F8 cycles it while you play.'), c: { t: 'seg', opts: [['off', N('Off')], ['on', N('On')], ['detailed', N('Detailed')]] }, more: true },
    { key: 'resolution', label: N('Fixed render size'), help: N('Renders every resolution at this size, for example 2560x1440. Empty uses the one chosen in the game.'), c: { t: 'text', placeholder: N('WxH') }, more: true },
    { key: 'max_pixels', label: N('Pixel limit'), help: N('Most pixels the screen-size resolution renders at 100% and below (0 = no limit). 150% and 200% scale up from it.'), c: { t: 'num', min: 0, step: 100000 }, more: true },
  ] },
  { title: N('Controller'), more: N('More controller settings'), items: [
    { key: 'rumble', label: N('Rumble'), help: N('On controllers that have it, and with the touch controls the phone\'s vibration: crashes, hard landings, the game\'s own force feedback and the tick of each button press.'), c: { t: 'switch' } },
    { key: 'gamepad', label: N('Controller'), help: N('On keeps a controller once it was connected; hotplug only while connected.'), c: { t: 'seg', opts: [['on', N('On')], ['hotplug', N('Hotplug')], ['off', N('Off')]] }, more: true },
    { key: 'gamepad_menu_keys', label: N('Menu buttons'), help: N('A, B and View also act as Enter, Esc and Q in the menus.'), c: { t: 'switch' }, more: true },
    { key: 'gamepad_deadzone', label: N('Stick dead zone'), help: N('Fraction of full travel, 0 to 0.9.'), c: { t: 'num', min: 0, max: 0.9, step: 0.01 }, more: true },
    { key: 'gamepad_trigger_deadzone', label: N('Trigger dead zone'), help: N('Fraction of full travel, 0 to 0.9.'), c: { t: 'num', min: 0, max: 0.9, step: 0.01 }, more: true },
    { key: 'gamepad_trigger_click', label: N('Trigger full press'), help: N('How far a trigger travels before it counts as fully pressed (full throttle, full brake).'), c: { t: 'num', min: 0, max: 1, step: 0.01 }, more: true },
  ] },
];

/** a row's second key, which its control writes with its own and its Reset resets too (not listed under "Other
 *  settings in this file"): the Crews row's colours */
const COMPANION: Record<string, string> = { roam_crew: 'roam_crew_colours', quick_chat_phrases: 'quick_chat_groups' };
const COMPANIONS = new Set(Object.values(COMPANION));
const SITE_SETTING_KEYS = new Set(SITE_KEYS);
/** Every key the panel shows (the check in app-test.mjs compares this with the template). */
export const PANEL_KEYS = [...GROUPS.flatMap(g => g.items.map(i => i.key)), ...COMPANIONS];
const ITEMS = new Map(GROUPS.flatMap(g => g.items.map(i => [i.key, i] as const)));
const GROUP_OF = new Map(GROUPS.flatMap(g => g.items.map(i => [i.key, g] as const)));

const boolOn = (v: string) => v === 'on';
const READ_ONLY = N('Read only here: another tab of this browser runs the game and owns its saves and settings. Change them there; this tab takes over when that one closes.');
const NOTE = N('Saved in this browser. Changes apply the next time you press Play.');

/** a small button with a drawn sign (the Crews row's Join and Leave), its name for a screen reader and as its tooltip */
function optLabel(it: Item, value: string, label: string): string {
  if (it.key !== 'language') return t(label);
  const own = NATIVE[value as Language] ?? value, here = t(label);
  return here === own ? own : `${here} · ${own}`;
}

/** A value as the panel shows it: the option's label, on/off, or the value with its unit. */
function shown(it: Item, v: string): string {
  const c = it.c;
  if (c.t === 'switch') return (v === 'on') !== !!c.inv ? t('on') : t('off');
  if (c.t === 'seg' || c.t === 'select') { const o = c.opts.find(([x]) => x.toLowerCase() === v.toLowerCase()); return o ? optLabel(it, o[0], o[1]) : v; }
  if (c.t === 'phrases') return phrasesOf(v).map(p => t(PHRASES[p].text)).join(', ');
  if (v === '') return t('empty');
  return c.t === 'num' && c.unit ? `${v} ${c.unit}` : v;
}

/**
 * settingsPut, and then the key's variable really is what the row asked for: a line that sets the same
 * variable by its own name (NFSU2_ROAM = 1 for roam) and comes first would still win at Play (the first line
 * that sets a variable does), so it goes too.  Lines are found by their line in the file, not by the pieces
 * bundle.m reads a long line in (a long line before them shifted the piece numbers: the audit review's PAGE-2
 * finding, which removed the wrong line).  removed: how many such lines went.
 */
export function putKey(text: string, key: string, value: string | null): { text: string; removed: number } {
  let next = settingsPut(text, key, value), removed = 0;
  const d = keyDef(key);
  for (let i = 0; d && i < 64; i++) {
    const by = resolveEnv(next, {}, {}).byEnv[d.env];
    if (!by || keyDef(by.key)?.key === d.key) break;
    const lines = next.split('\n'); lines.splice(by.phys - 1, 1); next = lines.join('\n'); removed++;
  }
  return { text: next, removed };
}

/** What "Reset all settings" keeps: the name the other players know you by, your crews, and the language (this
 *  page's too). */
const RESET_KEEPS = ['roam_name', 'license_plate', 'roam_crew', 'roam_crew_colours', 'language'];

/** "Reset all settings": the template, with the kept settings as the file has them (by their own key, also where
 *  the file sets the variable by its name, if the key reads the value the same).  One the file does not set, or
 *  refuses, is the default. */
export function resetAll(text: string | null): string {
  const r = resolveEnv(text, {}, {});
  let next = TEMPLATE;
  for (const key of RESET_KEEPS) {
    const env = keyDef(key)!.env, v = r.env[env], c = checkSetting(key, v ?? '');
    if (r.source[env] === 'settings.ini' && c?.ok && c.value === v) next = settingsPut(next, key, v);
  }
  return next;
}

/** A line the panel has no row for back to the default, by its line in the file (1-based): an option of the
 *  template gets the template's commented-out line in its place, any other line (a variable by its own name, the
 *  Mac app's options) goes. */
export function resetLine(text: string, phys: number): string {
  const lines = text.split('\n');
  const l = (lines[phys - 1] ?? '').trim();
  const eq = l.indexOf('=');
  if (eq < 0 || l[0] === '#' || l[0] === ';') return text;          // not a setting's line: nothing to reset
  const d = keyDef(l.slice(0, eq).trim());
  if (d && DEFAULTS.has(d.key)) lines[phys - 1] = `#${d.key} = ${DEFAULTS.get(d.key)}`.replace(/ = $/, ' =');
  else lines.splice(phys - 1, 1);
  return lines.join('\n');
}

export interface SettingsDeps {
  file: SettingsFile;
  environment: Record<string, string>;
  defaults?: Record<string, string>;
  onSaved?(text: string, previous: string | null): void;
  readOnly?(): boolean;
  say?(msg: string | Msg): void;
  onLoaded?(): void;
  confirm?(title: string, body: string, ok: string, danger?: boolean): Promise<boolean>;
}

export class SettingsService {
  text: string | null = null;
  private resolved!: Resolved;
  private fileOnly!: Resolved;
  private status: Msg = () => '';
  private crewCounts = new Map<number, number>();
  constructor(private deps: SettingsDeps) {}

  async load(): Promise<string | null> {
    this.text = await this.deps.file.read();
    this.resolve(this.text);
    return this.text;
  }
  private resolve(text: string | null) {
    this.resolved = resolveEnv(text, this.deps.environment, {});
    this.fileOnly = resolveEnv(text, {}, {});
  }

  /** Read settings.ini again and show it. */
  async refresh() {
    await this.load();
    this.deps.onLoaded?.();
  }

  /** One setting set as its row would set it (the language list at the top of the page). */
  set(key: string, value: string | null) { return this.put(key, value); }

  /** React's read-only schema: labels, choices and current values come from the existing settings catalogue. */
  reactSnapshot() {
    if (!this.fileOnly) return { ready: false, readOnly: true, note: t(N('Loading settings…')), groups: [] };
    const groups = GROUPS.filter(group => !group.own).map(group => ({
      title: t(group.title),
      moreLabel: this.moreLabel(group),
      items: group.items.map(item => {
        const control = item.c;
        const companion = COMPANION[item.key];
        const options = control.t === 'seg' || control.t === 'select'
          ? control.opts.map(([value, label]) => ({ value, label: optLabel(item, value, label) }))
          : [];
        const current = this.current(item.key);
        if (options.length && current && !options.some(option => option.value.toLowerCase() === current.toLowerCase())) {
          options.push({ value: current, label: current });
        }
        return {
          key: item.key,
          label: t(item.label),
          help: t(item.help),
          control: control.t,
          value: current,
          inverted: control.t === 'switch' ? !!control.inv : false,
          options,
          min: control.t === 'num' ? control.min : undefined,
          max: control.t === 'num' ? control.max : undefined,
          step: control.t === 'num' ? control.step : undefined,
          unit: control.t === 'num' ? control.unit : undefined,
          placeholder: control.t === 'text' && control.placeholder ? t(control.placeholder) : '',
          preview: control.t === 'select' && !!control.preview,
          modified: !!this.resolved.file[item.key]?.raw || (!!companion && !!this.resolved.file[companion]?.raw),
          link: item.link ? { text: t(item.link.text), href: item.link.href } : null,
        };
      }),
    }));
    return { ready: true, readOnly: this.ro(), note: t(this.ro() ? READ_ONLY : NOTE), groups };
  }

  /** React changes use the same catalogue, ownership guard, validation and settings.ini writer. */
  /** The raw editor and unlisted keys as an immutable React snapshot. */
  rawSnapshot() {
    if (!this.fileOnly) return { ready: false, readOnly: true, text: this.text ?? TEMPLATE, canResetAll: false, other: [] };
    const unshown = Object.entries(this.fileOnly.file)
      .filter(([key, field]) => !ITEMS.has(key) && !COMPANIONS.has(key) && !SITE_SETTING_KEYS.has(key) && field.raw !== '')
      .map(([key, field]) => ({ phys: field.phys, key, env: key, value: field.raw, refused: field.refused, why: field.why }));
    const other = [...this.fileOnly.other, ...unshown].sort((a, b) => a.phys - b.phys).map(item => ({
      line: item.phys,
      key: item.key,
      value: item.value,
      refused: item.refused ? t('{line} (ignored: {why})', {
        line: t('line {line}: {key} = {value}', { line: item.phys, key: item.key, value: item.value.length > 80 ? item.value.slice(0, 80) + '…' : item.value }),
        why: item.why ? tvars(item.why.t, item.why.v) : item.refused,
      }) : '',
      env: item.env !== item.key ? item.env : '',
    }));
    return {
      ready: true,
      readOnly: this.ro(),
      text: this.text ?? TEMPLATE,
      canResetAll: !this.ro() && resetAll(this.text) !== (this.text ?? TEMPLATE),
      other,
    };
  }

  async saveRawFromReact(raw: string): Promise<string> {
    if (this.ro()) throw new Error(t(READ_ONLY));
    const next = raw.endsWith('\n') ? raw : raw + '\n';
    const resolved = resolveEnv(next, this.deps.environment, {});
    const bad = resolved.notes.filter(note => /ignored$|only the page sets it$/.test(note) && !/is set in the environment|already set/.test(note));
    await this.write(next);
    return bad.length
      ? tn(bad.length, 'Saved. {n} line is ignored: {first}', 'Saved. {n} lines are ignored: {first} …', { first: bad[0] })
      : t('Saved.');
  }

  async resetAllFromReact(): Promise<boolean> {
    if (this.ro()) throw new Error(t(READ_ONLY));
    if (this.deps.confirm && !await this.deps.confirm(t('Reset all settings?'),
      t('Every setting here goes back to its default, and any other line in settings.ini is removed. Your name, crews and language stay, as do the options set inside the game.'),
      t('Reset'), true)) return false;
    if (this.ro()) throw new Error(t(READ_ONLY));
    await this.write(resetAll(this.text));
    this.deps.say?.(() => t('Settings are back to their defaults. Applies the next time you press Play.'));
    return true;
  }

  async resetOtherFromReact(line: number, key: string): Promise<void> {
    if (this.ro()) throw new Error(t(READ_ONLY));
    const exists = this.rawSnapshot().other.some(item => item.line === line && item.key === key);
    if (!exists) throw new Error('The settings.ini line changed. Refresh the editor before resetting it.');
    await this.write(resetLine(this.text ?? TEMPLATE, line));
    this.deps.say?.(() => t('Saved: {key} is back to its default. Applies the next time you press Play.', { key }));
  }

  async setFromReact(key: string, rawValue: string) {
    const item = ITEMS.get(key);
    if (!item || GROUP_OF.get(key)?.own) throw new Error('Unsupported React settings field');
    if (this.ro()) throw new Error(t(READ_ONLY));
    const control = item.c;
    const value = String(rawValue).trim();
    if (control.t === 'switch') {
      if (value !== 'on' && value !== 'off') throw new Error('Invalid switch value');
      await this.put(key, value);
      return;
    }
    if (control.t === 'seg' || control.t === 'select') {
      if (!control.opts.some(([option]) => option.toLowerCase() === value.toLowerCase()) && value !== this.current(key)) {
        throw new Error('Unsupported option');
      }
    } else if (control.t !== 'text' && control.t !== 'num') {
      throw new Error('This setting is not a React field');
    }
    if (!value) {
      const companion = COMPANION[key];
      const also: [string, string | null][] = companion ? [[companion, null]] : [];
      await this.put(key, null, also);
      return;
    }
    const checked = checkSetting(key, value);
    if (checked && !checked.ok) {
      throw new Error(t('Not saved: {key} = {why}.', { key, why: tvars(checked.why, checked.v) }));
    }
    await this.put(key, checked && checked.ok ? checked.value : value);
  }

  async resetFromReact(key: string) {
    const item = ITEMS.get(key);
    if (!item || GROUP_OF.get(key)?.own) throw new Error('Unsupported React settings reset');
    if (this.ro()) throw new Error(t(READ_ONLY));
    const companion = COMPANION[key];
    const also: [string, string | null][] = companion ? [[companion, null]] : [];
    await this.put(key, null, also);
  }

  async previewFromReact(key: string, value: string) {
    const item = ITEMS.get(key);
    if (!item || item.c.t !== 'select' || !item.c.preview) return;
    await item.c.preview.play(value);
  }

  stopPreviewFromReact(key: string) {
    const item = ITEMS.get(key);
    if (item?.c.t === 'select') item.c.preview?.stop();
  }

  /** React text fields reuse the same validation and normalization as the original setting rows. */
  async setValidated(key: string, value: string | null) {
    if (!['roam_name', 'license_plate', 'roam_room', 'roam_block', 'roam_max_cars'].includes(key)) throw new Error('Unsupported React settings field');
    if (this.ro()) { this.deps.say?.(t(READ_ONLY)); return; }
    let next = value?.trim() ?? '';
    if (key === 'roam_name' && next) next = onlineName(next) ?? next;
    if (next === this.current(key) && (next !== '' || !this.resolved.file[key]?.raw)) return;
    if (next === '') { await this.put(key, null); return; }
    const checked = checkSetting(key, next);
    if (checked && !checked.ok) {
      throw new Error(t('Not saved: {key} = {why}.', { key, why: tvars(checked.why, checked.v) }));
    }
    await this.put(key, checked && checked.ok ? checked.value : next);
  }


  /** Save crew names and colours together to preserve their shared order. */
  async saveCrewsFromReact(list: readonly Crew[]) {
    if (this.ro()) { this.deps.say?.(t(READ_ONLY)); return; }
    if (list.length > CREW_MAX) throw new Error(t('Up to 4 crews: leave one to join another.'));
    const names = crewsValue(list.map(crew => crew.name));
    const colours = rgbsValue(list);
    const checkedNames = checkSetting('roam_crew', names);
    const checkedColours = checkSetting('roam_crew_colours', colours);
    if (checkedNames && !checkedNames.ok) {
      throw new Error(t('Not saved: {key} = {why}.', { key: 'roam_crew', why: tvars(checkedNames.why, checkedNames.v) }));
    }
    if (checkedColours && !checkedColours.ok) {
      throw new Error(t('Not saved: {key} = {why}.', { key: 'roam_crew_colours', why: tvars(checkedColours.why, checkedColours.v) }));
    }
    await this.put(
      'roam_crew',
      names ? (checkedNames && checkedNames.ok ? checkedNames.value : names) : null,
      [['roam_crew_colours', colours ? (checkedColours && checkedColours.ok ? checkedColours.value : colours) : null]],
    );
  }

  /** Accept a live friend invite and save crew + room in one settings.ini write. */
  async joinCrewInvite(name: string, room: string) {
    if (this.ro()) throw new Error(t(READ_ONLY));
    const current = crewsOf(this.current('roam_crew'), this.current('roam_crew_colours'));
    const checkedCrew = checkCrew(name, current.map(crew => crew.name));
    if (!checkedCrew.ok) throw new Error(checkedCrew.why ? t(checkedCrew.why, { name: checkedCrew.name ?? '' }) : t('Crew invite is not valid.'));
    const next = [...current, { name: checkedCrew.name, rgb: freeColour(current) }];
    const names = crewsValue(next.map(crew => crew.name));
    const colours = rgbsValue(next);
    const checkedNames = checkSetting('roam_crew', names);
    const checkedColours = checkSetting('roam_crew_colours', colours);
    const normalizedRoom = room.trim();
    const checkedRoom = normalizedRoom ? checkSetting('roam_room', normalizedRoom) : null;
    if (checkedNames && !checkedNames.ok) throw new Error(t('Not saved: {key} = {why}.', { key: 'roam_crew', why: tvars(checkedNames.why, checkedNames.v) }));
    if (checkedColours && !checkedColours.ok) throw new Error(t('Not saved: {key} = {why}.', { key: 'roam_crew_colours', why: tvars(checkedColours.why, checkedColours.v) }));
    if (checkedRoom && !checkedRoom.ok) throw new Error(t('Not saved: {key} = {why}.', { key: 'roam_room', why: tvars(checkedRoom.why, checkedRoom.v) }));
    await this.put(
      'roam_room',
      normalizedRoom ? (checkedRoom && checkedRoom.ok ? checkedRoom.value : normalizedRoom) : null,
      [
        ['roam_crew', names ? (checkedNames && checkedNames.ok ? checkedNames.value : names) : null],
        ['roam_crew_colours', colours ? (checkedColours && checkedColours.ok ? checkedColours.value : colours) : null],
      ],
    );
    return next;
  }




  /** Save the sixteen phrase ids and four group ids together through the original settings validators. */
  async saveQuickChatFromReact(phrases: readonly number[], groups: readonly string[]) {
    if (this.ro()) { this.deps.say?.(t(READ_ONLY)); return; }
    if (phrases.length !== SLOTS || groups.length !== 4) throw new Error(t('Choose four groups of four phrases.'));
    const phraseValue = phrases.join(',');
    const groupValue = groups.join(',');
    const checkedPhrases = checkSetting('quick_chat_phrases', phraseValue);
    const checkedGroups = checkSetting('quick_chat_groups', groupValue);
    if (checkedPhrases && !checkedPhrases.ok) {
      throw new Error(t('Not saved: {key} = {why}.', { key: 'quick_chat_phrases', why: tvars(checkedPhrases.why, checkedPhrases.v) }));
    }
    if (checkedGroups && !checkedGroups.ok) {
      throw new Error(t('Not saved: {key} = {why}.', { key: 'quick_chat_groups', why: tvars(checkedGroups.why, checkedGroups.v) }));
    }
    const isDefault = phrases.every((value, index) => value === DEFAULT_PHRASES[index]) &&
      groups.every((value, index) => value === DEFAULT_GROUPS[index]);
    await this.put(
      'quick_chat_phrases',
      isDefault ? null : (checkedPhrases && checkedPhrases.ok ? checkedPhrases.value : phraseValue),
      [['quick_chat_groups', isDefault ? null : (checkedGroups && checkedGroups.ok ? checkedGroups.value : groupValue)]],
    );
  }

  /** A named launcher's safe snapshot: only explicitly allow-listed, validated settings. */
  profileValues(): Record<string, string> {
    if (!this.fileOnly) this.resolve(this.text);
    const values: Record<string, string> = {};
    for (const key of PROFILE_SETTING_KEYS) {
      const value = this.current(key), checked = checkSetting(key, value);
      if (checked?.ok && checked.value.toLowerCase() === value.toLowerCase()) values[key] = checked.value;
    }
    return values;
  }

  async applyProfileValues(name: string, values: Record<string, unknown>): Promise<boolean> {
    if (this.ro()) { this.deps.say?.(t(READ_ONLY)); return false; }
    if (!this.fileOnly) await this.load();
    const entries = Object.entries(values);
    if (!entries.length || entries.length > PROFILE_SETTING_KEYS.length) throw new Error('Invalid profile setting count');
    let next = this.text ?? TEMPLATE;
    for (const [key, raw] of entries) {
      if (!PROFILE_SETTING_SET.has(key) || typeof raw !== 'string' || raw.length > 128) throw new Error(`Refusing unsupported profile setting: ${key}`);
      const checked = checkSetting(key, raw);
      if (!checked?.ok || checked.value.toLowerCase() !== raw.toLowerCase()) throw new Error(`Refusing invalid profile setting: ${key}`);
      next = putKey(next, key, checked.value).text;
    }
    await this.writeProfileText(next);
    this.deps.say?.(() => t('Settings profile applied: {name}. Changes apply the next time you press Play.', { name }));
    return true;
  }

  async applyPreset(name: string, values: readonly (readonly [string, string])[]): Promise<boolean> {
    if (this.ro()) { this.deps.say?.(t(READ_ONLY)); return false; }
    if (!this.fileOnly) await this.load();
    let next = this.text ?? TEMPLATE;
    for (const [key, value] of values) {
      const definition = keyDef(key);
      const checked = checkSetting(key, value);
      if (!definition || !checked?.ok || checked.value.toLowerCase() !== value.toLowerCase()) throw new Error(`Refusing invalid preset setting: ${key}=${value}`);
      next = putKey(next, key, value).text;
    }
    await this.writeProfileText(next);
    this.deps.say?.(() => t('Settings preset saved: {name}. Changes apply the next time you press Play.', { name: t(name) }));
    return true;
  }

  private async writeProfileText(next: string) {
    await this.write(next);
  }

  /** What the file makes of a key's variable (on/off for booleans), else the template default.  The variable may
   *  be set by the key's own line or by a line with the variable's name (NFSU2_ROAM = 1): the row shows what
   *  applies either way (the audit's PAGE-2: such a line turned free roam on behind an "off" switch).  A raw
   *  value is read as the runtime reads it (an integer for NFSU2_ROAM, "starts with 0" for NOMOVIES). */
  current(key: string): string {
    const d = keyDef(key)!, r = this.fileOnly;
    if (r.source[d.env] === 'settings.ini') {
      const v = r.env[d.env];
      if (d.kind === 'bool') return parseInt(v, 10) === 1 ? 'on' : 'off';
      if (d.kind === 'boolInv') return v === '' || v.startsWith('0') ? 'on' : 'off';
      return v;
    }
    return this.deps.defaults?.[key] ?? DEFAULTS.get(key) ?? '';
  }

  readOnly() { return this.ro(); }

  private ro() { return !!this.deps.readOnly?.(); }

  /** key's line, and also's (a row's second key: COMPANION) in the same write */
  /** Your name written (a claim made under it: claim-ui.ts) */
  async putName(name: string) { await this.put('roam_name', name); }

  private async put(key: string, value: string | null, also: [string, string | null][] = []) {
    if (this.ro()) { this.deps.say?.(t(READ_ONLY)); return; }
    let next = this.text ?? TEMPLATE;
    for (const [k, v] of [[key, value] as [string, string | null], ...also]) next = putKey(next, k, v).text;
    await this.write(next);
    const it = ITEMS.get(key), cur = this.current(key);
    this.deps.say?.(() => {
      const v = { what: it ? t(it.label) : key, value: it ? shown(it, cur) : value ?? '' };
      return value === null ? t('Saved: {what}, {value} (the default). Applies the next time you press Play.', v) : t('Saved: {what}, {value}. Applies the next time you press Play.', v);
    });
  }

  private async write(next: string) {
    const previous = await this.deps.file.write(next);
    this.text = next;
    this.resolve(next);
    this.deps.onSaved?.(next, previous);
  }

  private moreLabel(g: Group): string {
    const n = g.items.filter(i => i.more && this.resolved.file[i.key]?.raw).length;
    return n ? t('{label} ({n} changed)', { label: t(g.more), n }) : t(g.more);
  }

  setStatus(line: string | Msg) { this.status = typeof line === 'string' ? () => line : line; }
  onlineStatus() { return this.status(); }
  setCrewCounts(counts: Map<number, number>) { this.crewCounts = counts; }
  crewCount(hash: number): number | undefined { return this.crewCounts.get(hash); }
}
