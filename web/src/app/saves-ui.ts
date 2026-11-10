// The saves section of the start page: the profiles in this browser (each can
// be renamed: profile.ts renameProfile), a backup of the whole save
// overlay as a zip (profiles, registry.txt, settings.ini, screenshots) and
// restoring one, or adding the PC game's profiles beside the ones here
// (readBackup tells them apart), and the F12 screenshots (shots.ts); a keyphrase's saves come in as a
// backup does (readVault, restoreVault: vault-ui.ts).  And the section at the bottom of the page, the game data on
// this PC: how much of it, all of it downloaded ahead (predownload.ts), or
// deleted.  The game data is never part of a backup and never written back:
// it stays on the server.

import { cacheBytes, clearCache, clearSaveDir, filesOf, isScreenshot, listFiles, listProfiles, PROFILES_DIR, readBytes, readText, writeFile, type Profile } from './savefs';
import { AUTOSAVE_SEEN, coverOf, garageModCars, isProfileFile, isProfileName, modCars, NAME_MAX, profileName, renameProfile, sealed, type RenameFiles } from './profile';
import { listZip, unzip, zip, ZipError, type ZipEntry } from './zip';
import { downloadBlob, stamp } from './logs';
import { fmtBytes } from './checks';
import { resolveEnv, withDevice } from './settings';
import { gameDataKept, type DownloadState, type DownloadStatus, type Predownload } from './predownload';
import { ScreenshotsPart } from './shots';
import { GAMEFILE, kept } from './vault';
import { listOf, N, t, tn, tvars, type Msg } from './i18n';

const SIDE_FILES = ['GARAGE.DAT', 'MODPARTS.DAT', 'MPWINS.DAT'] as const;

export interface SavesDeps {
  saveDir: string;
  /** true while a game runs in this tab: no rename, no restore, no cache delete */
  busy(): boolean;
  confirm(title: string, body: string, ok: string, danger?: boolean): Promise<boolean>;
  /** after a restore: settings.ini may have changed */
  onRestored(): void;
  /** the download of the game data (all but the movies) ahead of play */
  download: Predownload;
  /** the saves here changed (a rename, a restore): a keyphrase sends them */
  onChanged?(): void;
  /** notify the React save view when its snapshot or status message changes */
  onReactUpdate?(): void;
}

// Limits for a restore, judged by each entry's declared size before anything is
// inflated, and held while inflating (zip.ts stops an entry at its declared
// size: a 4 MB zip that declares 100 bytes and inflates to 4 GB is refused
// after 100, the audit's PAGE-4).  Screenshots (F12, about 24 MB each at this Mac's native size) have
// their own budget, so however many a backup holds they never crowd out the
// profiles, registry.txt or settings.ini (phase-1 app review, finding 5).
const MAX_ENTRY = 64 << 20, MAX_SHOTS = 512 << 20, MAX_OTHER = 256 << 20;
export { isScreenshot };

/**
 * What a backup's settings.ini would change that a player should know before restoring it: the network
 * (free roam on, the name shown to others), variables set by their own names, and lines the page ignores
 * (files and automation are the page's own).  [] when it holds none of these.
 */
export function settingsWarnings(text: string): string[] {
  const r = resolveEnv(text, {}, {});
  const set = (k: string) => r.source[k] === 'settings.ini';
  const out: string[] = [];
  const net = Object.keys(r.env).filter(k => set(k) && /^NFSU2_(ROAM|NET|LAN)/.test(k)).map(k => `${k}=${r.env[k]}`);
  if (set('NFSU2_ROAM') && parseInt(r.env.NFSU2_ROAM, 10) === 1)
    out.push(set('NFSU2_ROAM_NAME') ? t('It turns on free-roam multiplayer: your profile name (shown as "{name}"), car and position go to the other players on this server.', { name: r.env.NFSU2_ROAM_NAME })
      : t('It turns on free-roam multiplayer: your profile name, car and position go to the other players on this server.'));
  if (net.length) out.push(t('Network settings: {list}', { list: net.join(', ') }));
  const raw = r.other.filter(o => !o.refused).map(o => `${o.key} = ${o.value}`);
  if (raw.length) out.push(t('Variables set by their own names: {list}', { list: raw.slice(0, 6).join(', ') + (raw.length > 6 ? ' …' : '') }));
  const ignored = r.other.filter(o => o.refused === 'only the page sets it').map(o => o.key);
  if (ignored.length) out.push(t('Ignored, only the page sets them: {list}', { list: ignored.join(', ') }));
  return out;
}

/** A path from a backup that may be written into the save overlay, or null. */
export function safeEntryPath(name: string): string | null {
  const n = name.replace(/\\/g, '/');
  if (n.startsWith('/') || /^[A-Za-z]:/.test(n)) return null;
  const parts = n.split('/').filter(p => p !== '' && p !== '.');
  if (!parts.length || parts.some(p => p === '..' || p.length > 255 || /[\x00-\x1f]/.test(p))) return null;
  return parts.join('/');
}

export async function exportSaves(saveDir: string): Promise<{ zip: Uint8Array; files: number; name: string; shotBytes: number }> {
  const files = await listFiles(saveDir);
  const entries: ZipEntry[] = [];
  let shotBytes = 0;
  for (const f of files) {
    if (f.path === 'autotest-script.txt') continue;          // a test run's input script, not a save
    const data = await readBytes(saveDir, f.path);
    if (isScreenshot(f.path)) shotBytes += data.length;
    entries.push({ name: f.path, data, mtime: f.mtime });
  }
  return { zip: zip(entries), files: entries.length, name: `nfsu2-saves-${stamp()}.zip`, shotBytes };
}

export interface Restore {
  /**
   * 'backup': a backup of this page's (registry.txt or settings.ini at its top), which replaces everything here;
   * 'profiles': profiles alone, as the PC game keeps them (its NFS Underground 2 folder zipped in any shape, or one
   * profile's file), added beside the ones here (addProfiles)
   */
  kind: 'backup' | 'profiles';
  entries: { path: string; data: Uint8Array; mtime?: number }[];
  profiles: string[];
  /** entries left out: unsafe names, over the size limits, or (profiles) none of a profile's */
  skipped: string[];
  /** profile files the game would not load (profile.ts profileName), left out with their cover shoots */
  refused: { name: string; why: string }[];
  /** profiles with cars a mod added (profile.ts modCars), restored with a warning */
  modded: string[];
  /** profiles a save editor changed (profile.ts profileName's edited): sealed again, restored with a warning */
  edited: string[];
}

type FileIn = { path: string; data: Uint8Array; mtime?: number };
const lower = (s: string) => s.toLowerCase();

/** A zip of this page's backup or of the PC game's profiles, or a profile's own file (fileName: its name, for the messages). */
export async function readBackup(buf: Uint8Array, fileName = 'the file'): Promise<Restore> {
  if (isProfileFile(buf)) return profilesIn([{ path: fileName, data: buf }], []);
  // a backup zipped from a folder ("saves/NFS Underground 2/...") still restores: strip one common top folder
  const listed = await listZip(buf);
  const names = listed.map(n => safeEntryPath(n)).filter((x): x is string => !!x);
  const top = names.length && names.every(n => n.includes('/') && n.split('/')[0] === names[0].split('/')[0]) &&
    !names.some(n => n.startsWith(PROFILES_DIR + '/')) ? names[0].split('/')[0] + '/' : '';
  const local = (name: string) => { let p = safeEntryPath(name); if (p && top && p.startsWith(top)) p = p.slice(top.length); return p; };
  let shots = 0, other = 0;
  const refused: string[] = [];
  const all = await unzip(buf, (name, size) => {
    const p = local(name);
    if (!p || size > MAX_ENTRY) return false;
    if (isScreenshot(p)) return (shots += size) <= MAX_SHOTS || ((shots -= size), false);
    return (other += size) <= MAX_OTHER || ((other -= size), false);
  }, refused);
  const files = all.map(e => ({ path: local(e.name)!, data: e.data, mtime: e.mtime }));
  return files.some(e => e.path === 'registry.txt' || e.path === 'settings.ini') ? backupIn(files, refused) : profilesIn(files, refused);
}

/** A backup of this page's: every entry, but a profile the game would not load and its cover shoots. */
function backupIn(files: FileIn[], skipped: string[]): Restore {
  const out: Restore = { kind: 'backup', entries: [], profiles: [], skipped, refused: [], modded: [], edited: [] };
  const gone = new Set<string>();
  for (const e of files) {
    const s = e.path.split('/');
    if (s.length !== 3 || s[0] !== PROFILES_DIR || lower(s[2]) !== lower(s[1]) || coverOf(s[1])) continue;
    let r = profileName(e.data);
    if ('name' in r && lower(r.name) !== lower(s[1])) r = { bad: t('the name inside is "{name}"', { name: r.name }) };
    if ('bad' in r) { out.refused.push({ name: s[1], why: r.bad }); gone.add(lower(s[1])); continue; }
    out.profiles.push(s[1]);
    if (r.edited) { out.edited.push(s[1]); e.data = sealed(e.data); }
    if (modCars(e.data)) out.modded.push(s[1]);
  }
  out.entries = files.filter(e => {
    const s = e.path.split('/');
    return !(s.length >= 3 && s[0] === PROFILES_DIR && gone.has(lower(coverOf(s[1])?.profile ?? s[1])));
  });
  return out;
}

/**
 * Profiles found by what they hold, wherever they are in the zip: each one the game
 * would load goes to "NFS Underground 2/<the name inside>/", and its cover shoots
 * ("<NAME> DVD 1/<NAME> DVD 1" anywhere) beside it.  Everything else is left out.
 */
function profilesIn(files: FileIn[], skipped: string[]): Restore {
  const out: Restore = { kind: 'profiles', entries: [], profiles: [], skipped, refused: [], modded: [], edited: [] };
  const found = new Map<string, FileIn & { name: string; edited: boolean }>();
  const covers: (FileIn & { profile: string; cover: string })[] = [];
  // the files a profile's folder has beside it (this page's: slots 6-10, the parts kept beside it), taken with it
  const sides: (FileIn & { dir: string; name: string })[] = [];
  const dirOf = (path: string) => lower(path.split('/').slice(0, -1).join('/'));
  for (const e of files) {
    const s = e.path.split('/'), file = s[s.length - 1], folder = s.length > 1 ? s[s.length - 2] : '';
    const side = SIDE_FILES.find(n => lower(n) === lower(file));
    if (side && s.length > 1) { sides.push({ ...e, dir: dirOf(e.path), name: side }); continue; }
    const c = coverOf(file);                            // named as its folder; "20CM" too, but no profile
    if (c) { covers.push({ ...e, ...c }); continue; }
    if (!isProfileFile(e.data)) { out.skipped.push(e.path); continue; }
    const r = profileName(e.data);
    if ('bad' in r) out.refused.push({ name: folder || file, why: r.bad });
    else if (found.has(lower(r.name))) out.skipped.push(e.path);          // a second copy of one
    else found.set(lower(r.name), { ...e, name: r.name, edited: r.edited });
  }
  const took = new Set<FileIn>();
  for (const p of found.values()) {
    out.entries.push({ path: `${PROFILES_DIR}/${p.name}/${p.name}`, data: p.edited ? sealed(p.data) : p.data, mtime: p.mtime });
    out.profiles.push(p.name);
    if (p.edited) out.edited.push(p.name);
    // its folder's GARAGE.DAT and MODPARTS.DAT (a profile alone, at the zip's top or picked as a file: none)
    const dir = p.path.includes('/') ? dirOf(p.path) : null, mine = sides.filter(f => dir !== null && f.dir === dir);
    for (const f of mine) { out.entries.push({ path: `${PROFILES_DIR}/${p.name}/${f.name}`, data: f.data, mtime: f.mtime }); took.add(f); }
    if (modCars(p.data) || garageModCars(mine.find(f => f.name === 'GARAGE.DAT')?.data)) out.modded.push(p.name);
  }
  for (const f of sides) if (!took.has(f)) out.skipped.push(f.path);
  for (const c of covers) {
    const p = found.get(lower(c.profile));
    if (!p) { out.skipped.push(c.path); continue; }
    const folder = `${p.name} ${c.cover}`;
    out.entries.push({ path: `${PROFILES_DIR}/${folder}/${folder}`, data: c.data, mtime: c.mtime });
  }
  return out;
}

export async function restoreSaves(saveDir: string, r: Restore) {
  await clearSaveDir(saveDir);
  for (const e of r.entries) await writeFile(saveDir, e.path, e.data);
}

/**
 * A keyphrase's saves (vault.ts kept(): a zip of the save folder but the screenshots, the covers, the graphics options,
 * the LAN server's file and the device's own settings) as a backup of this page's, whatever is at their top:
 * restoreVault puts them in place of everything here.  The same checks as a backup's; what a keyphrase does not keep is
 * left out (in one sent before 2026-10-25: covers, black ones as they were then, and the other browser's graphics
 * options and device settings; before 2026-10-28: the other browser's gamefile.bin).
 */
export async function readVault(buf: Uint8Array): Promise<Restore> {
  const refused: string[] = [];
  let other = 0;
  const all = await unzip(buf, (name, size) => {
    const p = safeEntryPath(name);
    return !!p && !isScreenshot(p) && size <= MAX_ENTRY && ((other += size) <= MAX_OTHER || ((other -= size), false));
  }, refused);
  const files = all.map(e => ({ path: safeEntryPath(e.name)!, data: e.data, mtime: e.mtime }));
  return backupIn(kept(files), refused);
}

/** readVault's saves in place of the ones here: everything goes but what a keyphrase does not keep (vault.ts kept()):
 *  the screenshots (and a test's input script), the DVD and magazine covers of the profiles they bring, the game's
 *  graphics options, the LAN server's file, and the device's own settings, which settings.ini keeps from the one here
 *  (settings.ts withDevice). */
export async function restoreVault(saveDir: string, r: Restore) {
  const names = new Set(r.profiles.map(lower)), dec = new TextDecoder();
  const ini = r.entries.find(e => e.path === 'settings.ini');
  const settings = withDevice(ini ? dec.decode(ini.data) : null, await readText(saveDir, 'settings.ini'));
  await clearSaveDir(saveDir, name => isScreenshot(name) || name === 'autotest-script.txt' || name === 'registry.txt' || name === GAMEFILE || name === PROFILES_DIR);
  await clearSaveDir(saveDir, name => names.has(lower(coverOf(name)?.profile ?? '')), PROFILES_DIR);
  for (const e of r.entries) if (e !== ini) await writeFile(saveDir, e.path, e.data);
  if (settings !== null) await writeFile(saveDir, 'settings.ini', settings);
}

/** What a restore's question says of its profiles' state: changed by a save editor, mod cars, left out, skipped. */
function restoreNotes(r: Restore): string[] {
  const items: string[] = [];
  const refused = r.refused.map(x => `${x.name}: ${x.why}`).join('; ');
  if (r.edited.length) items.push(tn(r.edited.length, '{names} was changed outside the game, by a save editor (the checksums no longer matched): a value the game would not make itself may crash it or break the career.',
    '{names} were changed outside the game, by a save editor (the checksums no longer matched): a value the game would not make itself may crash it or break the career.', { names: listOf(r.edited) }));
  if (r.modded.length) items.push(tn(r.modded.length, '{names} has cars a mod added, which this game does not have: the game may crash or show them wrong when it loads them.',
    '{names} have cars a mod added, which this game does not have: the game may crash or show them wrong when it loads them.', { names: listOf(r.modded) }));
  if (refused) items.push(tn(r.refused.length, 'Left out, as the game would not load it: {list}.', 'Left out, as the game would not load them: {list}.', { list: refused }));
  const skipped = r.skipped.slice(0, 3).join(', ') + (r.skipped.length > 3 ? ' …' : '');
  if (r.skipped.length) items.push(r.kind === 'profiles' ? tn(r.skipped.length, '{n} other file is left out: {list}', '{n} other files are left out: {list}', { list: skipped })
    : tn(r.skipped.length, '{n} entry is skipped (an unsafe name, or over the size limits): {list}', '{n} entries are skipped (unsafe names, or over the size limits): {list}', { list: skipped }));
  return items;
}

/** What a backup's restore brings (or a keyphrase's, vault-ui.ts: the game's options stay), its profiles, the game's
 *  options, settings.ini, restoreNotes. */
export function backupItems(r: Restore, vault = false): string[] {
  const ini = r.entries.find(e => e.path === 'settings.ini');
  const warn = ini ? settingsWarnings(new TextDecoder().decode(ini.data)) : [];
  return [
    r.profiles.length ? t('Profiles: {names}', { names: r.profiles.join(', ') }) : t('No profiles'),
    ...vault ? [] : [r.entries.some(e => e.path === 'registry.txt') ? t('The game\'s options (registry.txt)') : t('No registry.txt: the next launch starts with fresh game options')],
    ini ? (warn.length ? `settings.ini. ${warn.join(' ')}` : 'settings.ini') : t('No settings.ini: the defaults apply'),
    ...restoreNotes(r),
  ];
}

/**
 * Add the profiles of a Restore of kind 'profiles'.  A profile of the same name here (in
 * any case: the I/O worker finds names so) goes, with its cover shoots; nothing else
 * changes.  The new folders are written before the old ones go.  Their names leave
 * AUTOSAVE_SEEN, so the page's Autosave comes to them as to new profiles.
 */
export async function addProfiles(fs: RenameFiles, r: Restore) {
  const names = new Set(r.profiles.map(lower));
  const written = new Set(r.entries.map(e => e.path.split('/')[1]));
  const paths = new Set(r.entries.map(e => e.path));
  const stale: string[] = [];
  const old = new Set<string>();
  for (const { path } of await fs.listFiles()) {
    const s = path.split('/');
    if (s.length >= 3 && s[0] === PROFILES_DIR && names.has(lower(coverOf(s[1])?.profile ?? s[1])) && !written.has(s[1])) old.add(s[1]);
    else if (s.length >= 3 && s[0] === PROFILES_DIR && written.has(s[1]) && lower(s[2]) === 'modparts.dat' && !paths.has(path)) stale.push(path);
  }
  for (const e of r.entries) await fs.writeFile(e.path, e.data);
  for (const path of stale) await fs.remove(path);
  for (const f of old) await fs.remove(`${PROFILES_DIR}/${f}`);
  const seen = await fs.readText(AUTOSAVE_SEEN);
  const kept = seen?.split('\n').filter(l => !names.has(lower(l.trim()))).join('\n');
  if (seen != null && kept !== seen) await fs.writeFile(AUTOSAVE_SEEN, kept!);
}

/** "about 3 min left" */
function eta(s: number): string {
  if (!isFinite(s)) return '';
  if (s < 60) return t('less than a minute left');
  if (s < 3600) return t('about {n} min left', { n: Math.round(s / 60) });
  return t('about {n} h left', { n: (s / 3600).toFixed(1) });
}
const QUIT_TO_CHANGE = N('Quit the game (or close the other tab that runs it) to change the game data.');
const QUIT_TO_RENAME = N('Quit the game (or close the other tab that runs it) to rename a profile or restore a backup.');

export class SavesPanel {
  readonly nameMax = NAME_MAX;
  constructor(private deps: SavesDeps) {
    this.shots = new ScreenshotsPart({ saveDir: deps.saveDir, confirm: deps.confirm, changed: () => void this.refresh() });
  }
  private readonly shots: ScreenshotsPart;
  private said = { saves: '', data: '' };
  private savesMessage: string | Msg = '';
  private dataMessage: string | Msg = '';
  private dataWarn = false;
  private dataInfo: string | Msg = () => t('Counting…');
  private preloadLabel = t('Preload the game data');
  private showPreload = false;
  private progressHidden = true;
  private data: { have: number; total: number } | null = null;
  private kept = { bytes: 0, files: 0 };
  private counted = 0;
  private shownState: DownloadState = 'idle';
  private profiles: Profile[] = [];
  private writing: Promise<unknown> = Promise.resolve();
  private messageText(value: string | Msg): string { return typeof value === 'string' ? value : value(); }
  private msg(value: string | Msg, en = '') { this.said.saves = en; this.savesMessage = value; this.deps.onReactUpdate?.(); }
  private dataMsg(value: string | Msg, warn = false, en = '') {
    this.said.data = en; this.dataMessage = value; this.dataWarn = warn; this.deps.onReactUpdate?.();
  }
  settled(): Promise<void> { return this.writing.then(() => {}, () => {}); }
  private write<T>(job: Promise<T>): Promise<T> { this.writing = job; return job; }
  snapshot() {
    return { profiles: this.profiles.map(profile => ({ name: profile.name, mtime: profile.mtime, size: profile.size })),
      busy: this.deps.busy(), message: this.messageText(this.savesMessage) };
  }
  shotsSnapshot() { return this.shots.snapshot(); }
  shotThumbnail(path: string) { return this.shots.thumbnail(path); }
  shotImageUrl(path: string) { return this.shots.imageUrl(path); }
  downloadShot(path: string) { this.shots.downloadFromReact(path); }
  deleteShot(path: string) { return this.shots.deleteFromReact(path); }
  gameDataSnapshot() {
    const status = this.deps.download.status;
    return { info: this.messageText(this.dataInfo), message: this.messageText(this.dataMessage), messageWarn: this.dataWarn,
      state: status.state, busy: this.deps.busy(), preloading: status.state === 'running' || status.state === 'paused',
      paused: status.state === 'paused', progress: status.total > 0 ? Math.floor(status.have / status.total * 100) : 0,
      showPreload: this.showPreload, preloadLabel: this.preloadLabel, progressHidden: this.progressHidden };
  }
  togglePreload(): Promise<void> { return this.doDownload(); }
  clearGameData(): Promise<void> { return this.doClearCache(); }
  exportBackup(): Promise<void> { return this.doExport(); }
  importBackup(file: File): Promise<void> { return this.doImport(file); }
  async renameFromReact(from: string, to: string): Promise<{ ok: boolean; message: string }> {
    const next = to.replace(/[^A-Za-z0-9]/g, '').slice(0, NAME_MAX);
    if (!isProfileName(next)) {
      const message = t('Letters and digits, up to {n}, as in the game.', { n: NAME_MAX });
      this.msg(message); return { ok: false, message };
    }
    if (next === from) return { ok: true, message: '' };
    if (this.deps.busy()) {
      const message = t(QUIT_TO_RENAME); this.msg(() => t(QUIT_TO_RENAME), QUIT_TO_RENAME);
      return { ok: false, message };
    }
    let result: Awaited<ReturnType<typeof renameProfile>>;
    try { result = await this.write(renameProfile(filesOf(this.deps.saveDir), PROFILES_DIR, from, next)); }
    catch (err) {
      const message = t('Renaming {name} stopped: {error}', { name: from, error: String(err) });
      this.msg(message); await this.refresh(); return { ok: false, message };
    }
    if ('refused' in result) { this.msg(result.refused); return { ok: false, message: result.refused }; }
    const message = () => t('Renamed {from} to {to}.', { from, to: next });
    this.msg(message); this.deps.onChanged?.(); await this.refresh();
    return { ok: true, message: message() };
  }
  async refresh() {
    const files = await listFiles(this.deps.saveDir);
    this.profiles = await listProfiles(this.deps.saveDir, files);
    this.shots.show(files.filter(file => isScreenshot(file.path)));
    const busy = this.deps.busy(); this.deps.onReactUpdate?.();
    if (busy) {
      this.msg(() => t(QUIT_TO_RENAME), QUIT_TO_RENAME);
      this.dataMsg(() => t(QUIT_TO_CHANGE), false, QUIT_TO_CHANGE);
    } else {
      if (this.said.saves === QUIT_TO_RENAME) this.msg('');
      if (this.said.data === QUIT_TO_CHANGE) this.dataMsg('');
    }
    if (this.deps.download.running) { this.showData(); return; }
    const current = ++this.counted;
    const [keptBytes, data] = await Promise.all([cacheBytes(), gameDataKept(this.deps.download.language(), this.deps.download.packs, this.deps.download.openTunnel()).catch(() => null)]);
    if (current !== this.counted) return;
    this.kept = keptBytes; this.data = data; this.showData();
  }
  showData(status: DownloadStatus = this.deps.download.status) {
    const active = status.state === 'running' || status.state === 'paused';
    if (active && status.total) this.data = { have: status.have, total: status.total };
    if (status.state !== this.shownState) {
      this.shownState = status.state;
      if (status.state === 'done') { this.data = { have: status.have, total: status.total }; this.dataMsg(() => t('The game data is on this PC now.')); }
      if (status.state === 'error') { const error = status.error; this.dataMsg(() => t('Preloading stopped: {error}. What it preloaded is kept.', { error: error ?? '' }), true); }
      if (!active) void this.refresh();
    }
    const data = this.data, rest = data ? data.total - data.have : 0;
    this.progressHidden = !active;
    if (active) {
      const fraction = data?.total ? data.have / data.total : 0;
      this.showPreload = true; this.preloadLabel = t('Stop preloading');
      this.dataInfo = status.state === 'paused'
        ? (data
          ? t('Preloading paused while the game runs: {have} of {total}. It goes on when the game ends.', { have: fmtBytes(data.have), total: fmtBytes(data.total) })
          : t('Preloading paused while the game runs: counting. It goes on when the game ends.'))
        : !data
          ? t('Preloading the game data: counting what is here already.')
          : t('Preloading the game data: {have} of {total} ({pct} %){speed}. Play whenever you like: preloading pauses while the game runs and goes on after it.',
            { have: fmtBytes(data.have), total: fmtBytes(data.total), pct: Math.floor(fraction * 100), speed: status.rate ? `, ${fmtBytes(status.rate)}/s, ${eta(rest / status.rate)}` : '' });
      this.deps.onReactUpdate?.(); return;
    }
    this.preloadLabel = data && data.have
      ? t('Preload the rest ({size})', { size: fmtBytes(rest) })
      : data ? t('Preload the game data ({size})', { size: fmtBytes(data.total) }) : t('Preload the game data');
    this.showPreload = !(data && rest <= 0);
    if (data && rest <= 0) {
      this.dataInfo = 'serviceWorker' in navigator
        ? t('The game data ({size}) is kept in this browser: the game loads it from this PC, not the network. Only the movies stream from the server, as they play, and the game starts without the server too (offline, with the movies off). Deleting it only means loading it from the server again.', { size: fmtBytes(data.total) })
        : t('The game data ({size}) is kept in this browser: the game loads it from this PC, not the network. Only the movies stream from the server, as they play. Deleting it only means loading it from the server again.', { size: fmtBytes(data.total) });
    } else if (data ? data.have : this.kept.bytes) {
      this.dataInfo = (data
        ? t('{have} of the game\'s {total} (without the movies) is kept in this browser, so the game loads that from this PC instead of the network.', { have: fmtBytes(data.have), total: fmtBytes(data.total) })
        : t('{have} is kept in this browser, so the game loads that from this PC instead of the network.', { have: fmtBytes(this.kept.bytes) })) + ' ' +
        t('Preload the rest too, and no loading screen waits on the network. Deleting it only means loading it from the server again.');
    } else {
      this.dataInfo = t('Nothing here yet. The game streams its data from the server as it needs it and keeps it here. Preload it now (all but the movies, compressed on the way) and no loading screen waits on the network.');
    }
    this.deps.onReactUpdate?.();
  }

  private async doDownload() {
    const dl = this.deps.download;
    if (dl.running) { await dl.stop(); this.dataMsg(() => t('Preloading stopped. What it preloaded is kept: Preload the rest goes on from there.')); return; }
    if (this.deps.busy()) return;
    this.dataMsg('');
    dl.start();
  }

  private async doExport() {
    try {
      const e = await exportSaves(this.deps.saveDir);
      downloadBlob(e.zip as BlobPart, e.name, 'application/zip');
      this.msg(() => tn(e.files, 'Downloaded {name}: {n} file, {size}.', 'Downloaded {name}: {n} files, {size}.', { name: e.name, size: fmtBytes(e.zip.length) }) + (e.shotBytes > MAX_SHOTS
        ? ' ' + t('It holds {shots} of screenshots: a restore keeps the saves and settings and only the first {max} of screenshots.', { shots: fmtBytes(e.shotBytes), max: fmtBytes(MAX_SHOTS) }) : ''));
    } catch (err) { this.msg(() => t('The backup failed: {error}', { error: String(err) })); }
  }

  private async doImport(file: File) {
    if (this.deps.busy()) { this.msg(() => t('Quit the game first: restoring replaces the saves it is using.')); return; }
    let r: Restore;
    try { r = await readBackup(new Uint8Array(await file.arrayBuffer()), file.name); }
    catch (err) {
      const name = file.name;
      this.msg(() => err instanceof ZipError ? t('{file} cannot be restored: {why}.', { file: name, why: err.message === 'not a zip file' ? t('it is neither a backup (a zip) nor a profile of the game\'s') : err.message })
        : t('{file} cannot be read: {error}', { file: name, error: String(err) }));
      return;
    }
    const refused = r.refused.map(x => `${x.name}: ${x.why}`).join('; ');
    if (!r.profiles.length && (r.kind === 'profiles' || !r.entries.length)) {
      const one = r.refused.length === 1 ? r.refused[0] : null;
      const covers = r.skipped.length && r.skipped.every(s => coverOf(s.split('/').pop()!));
      const name = file.name;
      this.msg(() => one ? (one.name === name ? t('{file} cannot be restored: {why}.', { file: name, why: one.why }) : t('The profile {name} in {file} cannot be restored: {why}.', { name: one.name, file: name, why: one.why }))
        : refused ? t('{file} has no profile the game can load: {list}.', { file: name, list: refused })
        : covers ? t('{file} holds DVD or magazine covers only: they come with their profile, in a zip of the NFS Underground 2 folder.', { file: name })
        : t('{file} has no save files.', { file: name }));
      return;
    }
    const list = listOf;
    const items: string[] = [];
    const here = new Map(this.profiles.map(x => [x.name.toLowerCase(), x.name]));
    const replaced = r.profiles.map(n => here.get(n.toLowerCase())).filter((x): x is string => !!x);
    let description = '';
    if (r.kind === 'profiles') {
      description = tn(r.profiles.length, 'Adds the profile in {file} to this browser. The other profiles here, the game\'s options and settings.ini stay as they are.',
        'Adds the profiles in {file} to this browser. The other profiles here, the game\'s options and settings.ini stay as they are.', { file: file.name });
      items.push(t('Profiles: {names}', { names: r.profiles.map(n => {
        const covers = r.entries.filter(e => coverOf(e.path.split('/')[1])?.profile === n).length;
        return covers ? tn(covers, '{name} (with its cover shoot)', '{name} (with its {n} cover shoots)', { name: n }) : n;
      }).join(', ') }));
      if (replaced.length) items.push(tn(replaced.length, 'Replaces the profile {names} in this browser, its career and cover shoots too',
        'Replaces the profiles {names} in this browser, their careers and cover shoots too', { names: list(replaced) }));
      items.push(...restoreNotes(r));
    } else {
      description = tn(r.entries.length, 'Restoring replaces every profile, the game\'s options and settings.ini in this browser with the {n} file in {file}.',
        'Restoring replaces every profile, the game\'s options and settings.ini in this browser with the {n} files in {file}.', { file: file.name });
      items.push(...backupItems(r));
    }
    const body = [description, ...items.map(item => `• ${item}`)].join('\n');
    const adding = r.kind === 'profiles';
    const many = r.profiles.length > 1, name = file.name;
    if (!await this.deps.confirm(adding ? (many ? t('Add these profiles?') : t('Add this profile?')) : t('Restore this backup?'), body,
      adding ? (many ? t('Add profiles') : t('Add profile')) : t('Restore backup'), !adding || replaced.length > 0)) { this.msg(() => t('Nothing changed.')); return; }
    try {
      if (adding) {
        await this.write(addProfiles(filesOf(this.deps.saveDir), r));
        this.msg(() => t('Added {names} from {file}.', { names: list(r.profiles), file: name }));
      } else {
        await this.write(restoreSaves(this.deps.saveDir, r));
        this.msg(() => tn(r.entries.length, 'Restored {n} file from {file}.', 'Restored {n} files from {file}.', { file: name }));
        this.deps.onRestored();
      }
    } catch (err) {
      this.msg(() => adding ? t('Adding stopped halfway: {error}. Add the profiles again before playing.', { error: String(err) })
        : t('Restoring stopped halfway: {error}. Restore the backup again before playing.', { error: String(err) }));
    }
    this.deps.onChanged?.();
    await this.refresh();
  }

  private async doClearCache() {
    if (this.deps.busy()) return;
    const dl = this.deps.download;
    if (!await this.deps.confirm(t('Delete the game data on this PC?'), (dl.running ? t('This stops preloading.') + ' ' : '') +
      t('The game will stream it from the server again the next time, which is slower once. Your saves are not touched.'), t('Delete game data'), true)) return;
    await dl.stop();
    await clearCache();
    await this.refresh();
    this.dataMsg(() => t('Game data on this PC deleted.'));
  }
}