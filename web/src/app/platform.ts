// The extra platform tools: a local garage/favorites catalogue, a safe mod-link library,
// validated settings profiles, accessibility preferences, update checks and translation audits.
// This module never writes to the server's game folder; the browser is a client, not an installer.
import { LANGUAGES, LOCALE, NATIVE, N, lastLanguage, onLanguage, setLanguage, t } from './i18n';
import { PROFILE_SETTING_KEYS, type SettingsService } from './settings-service';
import { checkSetting } from './settings';



export const APP_BUILD_VERSION = '2026.10.30.04';
// Keep messages used through conditional/dynamic paths in the translation catalogue.
const PLATFORM_TEXT_KEYS = [
  N('Add to favorites'), N('Remove from favorites'), N('Not found on server'), N('Manifest unavailable in this preview.'),
  N('No server pack manifest is available in this preview.'), N('The profile name must be 1 to 40 printable characters.'),
  N('Could not save the profile.'), N('Profile saved.'), N('Profile imported.'), N('Invalid profile file.'), N('Profile deleted.'),
  N('The local mod-link list is full.'), N('Could not save the mod link.'), N('The mod name is required.'),
  N('A valid HTTP or HTTPS URL is required.'), N('Saved in this browser.'), N('Could not check translations.'),
  N('The server build is older than this page.'), N("You're up to date."), N('Update available. Reload when ready.'),
  N('Version information is not available on this server.'), N('Settings profile applied: {name}. Changes apply the next time you press Play.'),
  N('The profile could not be applied in this tab.'), N('Delete mod link'), N('Copy link'), N('Link copied.'),
  N('Expected game-data path must be a safe relative path.'), N('Invalid mod list file.'), N('Mod list imported.'),
  N('Mod list exported.'), N('Server file detected'), N('File not found on server'), N('Not checked'),
  N('Set as preferred'), N('Preferred vehicle'), N('Clear preferred vehicle'), N('No preferred vehicle selected.'),
  N('Preferred vehicle: {name}'), N('Browse vehicles, filter by make or class, and choose a preferred car for this browser.'),
  N('Save mod links, track expected files, and export your mod list.'),
  N('Mod links: {count}'), N('The mod list stores names and links only. It does not contain mod files.'), N('This mod link is already saved.'),
  N('No vehicles match these filters.'), N('No mod links match these filters.'), N('No custom mod links saved yet.'), N('Filter saved mods by category'), N('All mod categories'),
  N('Import vehicle package (.zip)'), N('Imported add-on vehicles'), N('Choose a vehicle-mod ZIP containing a CARS/<TYPE>/ folder.'),
  N('Vehicle package imported: {name}. {count} files are saved in this browser.'), N('Vehicle package import failed.'), N('Vehicle ZIP exceeds the 150 MB limit.'),
  N('This is not a valid or supported ZIP archive.'), N('The archive contains too many files.'), N('Unsafe path in vehicle package; import was stopped.'),
  N('Executable or web-script files are not accepted in a vehicle package.'), N('No CARS/<TYPE>/ vehicle files were found.'), N('A package must contain exactly one CARS/<TYPE>/ vehicle.'),
  N('This package uses a stock vehicle type. Add-on packages must use a new type name.'), N('This vehicle type is already imported.'), N('The package exceeds the file-count or uncompressed-size limit.'),
  N('Vehicle metadata is invalid or does not match the CARS folder.'), N('Could not save this vehicle package in browser storage.'),
  N('Power: {value} hp'), N('Top speed: {value} km/h'), N('0–100 km/h: {value} s'), N('Handling: {value}/10'), N('Braking: {value}/10'),
  N('This package does not provide performance metadata.'), N('These values come from the package metadata and have not been verified against the game binaries.'),
  N('Garage-only paint preference'), N('Garage-only visual options'), N('Selected for the next game launch. The runtime will load this add-on when gameplay starts if its files are compatible.'),
  N('Remove imported vehicle'), N('Remove {name} and its locally stored files?'), N('No imported add-on vehicles yet.'),
  N('Imported assets are stored in this browser and exposed through a read-only /data overlay on the next game launch.'),
  N('This pack lacks root GEOMETRY.BIN or TEXTURES.BIN; it can be stored, but the game runtime will not select it.'),
  N('The selected add-on was not passed to the game because its required geometry/texture files are missing.'),
  N('Paint choice saved in the garage. A custom color is applied in-game only when the pack provides a supported game paint part.'),
  N('Visual choices are sent to the game runtime; only part names compatible with the installed game part database can be applied.'),
  N('Selected add-on car can be passed to the game runtime at Play. Model compatibility still depends on the pack and engine support.'),
  N('Only add-on packs with root-level GEOMETRY.BIN and TEXTURES.BIN are sent to the game.'),
  N('Vehicle package files: {count}'), N('No paint colors or visual-part options were provided by this package.'), N('Select paint color'), N('Choose {category}'),
  N('Checking vehicle package safely…'), N('Vehicle package removed: {name}.'), N('Import a vehicle mod'),
  N('The mod-link list stores links only. Use the vehicle package importer in the Garage section to stage a local CARS/<TYPE>/ ZIP; this browser never writes to server game files.'),
] as const;
void PLATFORM_TEXT_KEYS;
const STORE = {
  favorites: 'trpolaris-favorites-v1',
  customMods: 'trpolaris-custom-mods-v1',
  accessibility: 'trpolaris-accessibility-v1',
  onboarding: 'trpolaris-onboarding-v1',
  profiles: 'trpolaris-config-profiles-v1',
  preferredVehicle: 'trpolaris-preferred-vehicle-v1',
};
let modStatusText = '';
let serverVersion = '—';
let updateStatus = '';
let updateReloadAvailable = false;
let translationStatus = '';
let privacyStatus = '';
const notifyPlatform = () => window.dispatchEvent(new Event('trp-platform-changed'));
const notifyModLibrary = () => window.dispatchEvent(new Event('trp-mod-library-changed'));
const setModStatus = (message: string) => { modStatusText = message; notifyModLibrary(); };

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const safeRead = <T>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value) as T; }
  catch { return fallback; }
};
const safeWrite = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};
type VehicleClass = 'Compact' | 'Tuner' | 'Sport' | 'Muscle' | 'SUV';
type VehicleBody = 'Hatchback' | 'Sedan' | 'Coupe' | 'Roadster' | 'SUV';
const CAR_DATA: readonly { name: string; make: string; className: VehicleClass; body: VehicleBody }[] = [
  { name: 'Peugeot 106', make: 'Peugeot', className: 'Compact', body: 'Hatchback' },
  { name: 'Ford Focus', make: 'Ford', className: 'Tuner', body: 'Hatchback' },
  { name: 'Toyota Corolla', make: 'Toyota', className: 'Tuner', body: 'Sedan' },
  { name: 'Nissan 240SX', make: 'Nissan', className: 'Tuner', body: 'Coupe' },
  { name: 'Mazda Miata', make: 'Mazda', className: 'Sport', body: 'Roadster' },
  { name: 'Honda Civic', make: 'Honda', className: 'Tuner', body: 'Coupe' },
  { name: 'Peugeot 106 GTI', make: 'Peugeot', className: 'Compact', body: 'Hatchback' },
  { name: 'Opel Corsa', make: 'Opel', className: 'Compact', body: 'Hatchback' },
  { name: 'Hummer H2', make: 'Hummer', className: 'SUV', body: 'SUV' },
  { name: 'Lincoln Navigator', make: 'Lincoln', className: 'SUV', body: 'SUV' },
  { name: 'Cadillac Escalade', make: 'Cadillac', className: 'SUV', body: 'SUV' },
  { name: 'Hyundai Tiburon', make: 'Hyundai', className: 'Tuner', body: 'Coupe' },
  { name: 'Nissan Sentra', make: 'Nissan', className: 'Tuner', body: 'Sedan' },
  { name: 'Toyota Celica', make: 'Toyota', className: 'Tuner', body: 'Coupe' },
  { name: 'Lexus IS 300', make: 'Lexus', className: 'Sport', body: 'Sedan' },
  { name: 'Toyota Supra', make: 'Toyota', className: 'Sport', body: 'Coupe' },
  { name: 'Volkswagen Golf GTI', make: 'Volkswagen', className: 'Tuner', body: 'Hatchback' },
  { name: 'Audi A3', make: 'Audi', className: 'Tuner', body: 'Hatchback' },
  { name: 'Acura RSX', make: 'Acura', className: 'Tuner', body: 'Coupe' },
  { name: 'Mitsubishi Eclipse GSX', make: 'Mitsubishi', className: 'Tuner', body: 'Coupe' },
  { name: 'Audi TT', make: 'Audi', className: 'Sport', body: 'Coupe' },
  { name: 'Mazda RX-8', make: 'Mazda', className: 'Sport', body: 'Coupe' },
  { name: 'Nissan 350Z', make: 'Nissan', className: 'Sport', body: 'Coupe' },
  { name: 'Infiniti G35', make: 'Infiniti', className: 'Sport', body: 'Coupe' },
  { name: 'Mitsubishi 3000GT', make: 'Mitsubishi', className: 'Sport', body: 'Coupe' },
  { name: 'Pontiac GTO', make: 'Pontiac', className: 'Muscle', body: 'Coupe' },
  { name: 'Ford Mustang GT', make: 'Ford', className: 'Muscle', body: 'Coupe' },
  { name: 'Nissan Skyline GT-R', make: 'Nissan', className: 'Sport', body: 'Coupe' },
  { name: 'Mitsubishi Lancer Evolution VIII', make: 'Mitsubishi', className: 'Tuner', body: 'Sedan' },
  { name: 'Mazda RX-7', make: 'Mazda', className: 'Sport', body: 'Coupe' },
  { name: 'Subaru Impreza WRX', make: 'Subaru', className: 'Tuner', body: 'Sedan' },
];
const CARS = CAR_DATA.map((car, i) => ({ ...car, id: `car:${i}` }));
let stockVisibleCount = CARS.length;

// Vehicle-preview blobs can be sizable, so defer reading/decoding until a card nears the viewport.



let vehiclePackConfirm: ((title: string, body: Node | string, ok: string, danger?: boolean) => Promise<boolean>) | null = null;
const VEHICLE_TEXT_KEYS = [
  N('Compact'), N('Tuner'), N('Sports'), N('Muscle'), N('SUV'), N('Hatchback'), N('Sedan'), N('Coupe'), N('Roadster'),
  N('All manufacturers'), N('All vehicle classes'), N('Manufacturer'), N('Vehicle class'), N('Body style'),
  N('Vehicle'), N('Visuals'), N('Audio'), N('Translation'), N('Gameplay'), N('Other'),
] as const;
void VEHICLE_TEXT_KEYS;
type ModCategory = 'vehicle' | 'visual' | 'audio' | 'translation' | 'gameplay' | 'other';
const MOD_CATEGORIES: readonly ModCategory[] = ['vehicle', 'visual', 'audio', 'translation', 'gameplay', 'other'];
interface CustomMod { id: string; name: string; url: string; createdAt: number; category?: ModCategory; targetPath?: string }
interface ConfigProfile { schema: 1; id: string; name: string; createdAt: number; values: Record<string, string> }
interface AccessibilityPrefs { largeText: boolean; reduceMotion: boolean; highContrast: boolean }
const DEFAULT_A11Y: AccessibilityPrefs = { largeText: false, reduceMotion: false, highContrast: false };

/** Read current browser-local accessibility preferences without changing their storage format. */
export function currentAccessibilityPrefs(): AccessibilityPrefs {
  const value = safeRead<Partial<AccessibilityPrefs>>(STORE.accessibility, {});
  return { ...DEFAULT_A11Y, ...Object.fromEntries(Object.entries(value).filter(([key, v]) =>
    key in DEFAULT_A11Y && typeof v === 'boolean')) } as AccessibilityPrefs;
}

/** Persist one React-controlled browser accessibility preference and apply its document attributes. */
export function setAccessibilityPreference(key: keyof AccessibilityPrefs, value: boolean): AccessibilityPrefs {
  const prefs = { ...currentAccessibilityPrefs(), [key]: value };
  applyAccessibility(prefs);
  window.dispatchEvent(new Event('trp-accessibility-changed'));
  return prefs;
}
const KNOWN_PACKS = [
  {
    id: 'mod:turkish', name: 'Turkish translation pack',
    detail: 'Three language override files; installed by the server operator into the game-data folder.',
    source: '', paths: ['langpacks/turkish/languages/english.bin', 'langpacks/turkish/languages/languagetextures.bin', 'langpacks/turkish/global/globala.bun'],
  },
  {
    id: 'mod:uhud', name: 'Upscaled HUD texture pack',
    detail: 'A high-resolution replacement for the menus and racing HUD.',
    source: 'https://nfsmods.xyz/mod/4319', paths: ['texpacks/uhud.pak'],
  },
  {
    id: 'mod:subtitles', name: 'English subtitle improvements',
    detail: 'Subtitle data supplied with the language pack, where configured on the server.',
    source: 'https://nfsmods.xyz/mod/5286', paths: ['langpacks/english/subtitles/'],
  },
];
const LANGUAGE_PACKS = ['french', 'german', 'italian', 'spanish', 'japanese', 'russian', 'portuguese', 'polish', 'thai'];

function getFavorites(): Set<string> {
  const values = safeRead<unknown>(STORE.favorites, []);
  return new Set(Array.isArray(values) ? values.filter((x): x is string => typeof x === 'string' && x.length < 100) : []);
}
function saveFavorites(values: Set<string>) { safeWrite(STORE.favorites, [...values]); }
function getCustomMods(): CustomMod[] {
  const value = safeRead<unknown>(STORE.customMods, []);
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is CustomMod => !!x && typeof x === 'object' && typeof x.id === 'string' &&
    typeof x.name === 'string' && !/[\u0000-\u001f\u007f]/.test(x.name) && typeof x.url === 'string' && validHttpUrl(x.url) && x.name.trim().length > 0 && x.name.length <= 80)
    .map(x => ({ ...x, category: isModCategory(x.category) ? x.category : 'other', targetPath: typeof x.targetPath === 'string' && validRelativeGamePath(x.targetPath) ? normalizeGamePath(x.targetPath) : '' })).slice(0, 100);
}
function saveCustomMods(mods: CustomMod[]) { return safeWrite(STORE.customMods, mods.slice(0, 100)); }
function isModCategory(value: unknown): value is ModCategory { return typeof value === 'string' && (MOD_CATEGORIES as readonly string[]).includes(value); }

export interface ModLinkActionResult { ok: boolean; message: string; }
export function addCustomModLink(rawName: string, rawUrl: string, rawCategory: string, rawPath: string): ModLinkActionResult {
  const name = rawName.trim(), url = rawUrl.trim(), targetPath = rawPath.trim();
  const fail = (message: string): ModLinkActionResult => { setModStatus(message); return { ok: false, message }; };
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return fail(t('The mod name is required.'));
  if (!validHttpUrl(url)) return fail(t('A valid HTTP or HTTPS URL is required.'));
  if (targetPath && !validRelativeGamePath(targetPath)) return fail(t('Expected game-data path must be a safe relative path.'));
  if (!isModCategory(rawCategory)) return fail(t('Invalid mod list file.'));
  const mods = getCustomMods();
  if (mods.length >= 100) return fail(t('The local mod-link list is full.'));
  if (mods.some(mod => mod.name.toLocaleLowerCase() === name.toLocaleLowerCase() && mod.url === url)) return fail(t('This mod link is already saved.'));
  const id = 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  mods.push({ id, name, url, category: rawCategory, targetPath: targetPath ? normalizeGamePath(targetPath) : '', createdAt: Date.now() });
  if (!saveCustomMods(mods)) return fail(t('Could not save the mod link.'));
  const message = t('Saved in this browser.');
  setModStatus(message);
  return { ok: true, message };
}

function normalizeGamePath(value: string): string { return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/'); }
function validRelativeGamePath(raw: string): boolean {
  if (!raw) return false;
  const normalized = normalizeGamePath(raw.trim());
  if (!normalized || normalized.length > 180 || /^[a-z]:/i.test(raw.trim()) || raw.trim().startsWith('/') || raw.trim().startsWith('\\')) return false;
  const parts = normalized.split('/');
  return parts.every(part => !!part && part !== '.' && part !== '..' && /^[\p{L}\p{N}._ -]+$/u.test(part));
}
function validHttpUrl(raw: string): boolean {
  if (!raw || raw.length > 2048) return false;
  try { const url = new URL(raw); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password; }
  catch { return false; }
}
function versionParts(value: string): number[] | null {
  if (!/^\d+(?:\.\d+){1,3}$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every(n => Number.isSafeInteger(n) && n >= 0) ? parts : null;
}
export function compareBuildVersions(a: string, b: string): number | null {
  const aa = versionParts(a), bb = versionParts(b);
  if (!aa || !bb) return null;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const d = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

function vehicleGlyph(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 120 64'); svg.setAttribute('aria-hidden', 'true');
  const body = document.createElementNS(ns, 'path'); body.setAttribute('d', 'M12 40 19 29 Q21 26 31 24 L42 12 Q46 8 55 8 H77 Q85 8 91 18 L100 27 108 31 111 42 106 49 H99 A10 10 0 0 0 79 49 H42 A10 10 0 0 0 22 49 H15 Z'); body.setAttribute('class', 'car-glyph-body');
  const window = document.createElementNS(ns, 'path'); window.setAttribute('d', 'M38 24 47 14 Q50 12 56 12 H75 Q81 12 85 20 L89 26 Z'); window.setAttribute('class', 'car-glyph-window');
  const wheel1 = document.createElementNS(ns, 'circle'); wheel1.setAttribute('cx', '32'); wheel1.setAttribute('cy', '47'); wheel1.setAttribute('r', '7'); wheel1.setAttribute('class', 'car-glyph-wheel');
  const wheel2 = document.createElementNS(ns, 'circle'); wheel2.setAttribute('cx', '89'); wheel2.setAttribute('cy', '47'); wheel2.setAttribute('r', '7'); wheel2.setAttribute('class', 'car-glyph-wheel');
  svg.append(body, window, wheel1, wheel2); return svg;
}
function favoriteButton(id: string, onToggle: () => void): HTMLButtonElement {
  const fav = getFavorites().has(id), button = document.createElement('button');
  button.type = 'button'; button.className = 'favorite-button'; button.setAttribute('aria-pressed', String(fav));
  button.setAttribute('aria-label', t(fav ? 'Remove from favorites' : 'Add to favorites'));
  button.title = t(fav ? 'Remove from favorites' : 'Add to favorites');
  const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); star.setAttribute('viewBox', '0 0 24 24'); star.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'm12 2.7 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z'); star.append(path);
  const text = document.createElement('span'); text.textContent = t(fav ? 'Remove from favorites' : 'Add to favorites'); text.className = 'visually-hidden'; button.append(star, text);
  button.onclick = onToggle; return button;
}
function toggleFavorite(id: string) {
  const fav = getFavorites(); if (fav.has(id)) fav.delete(id); else fav.add(id); saveFavorites(fav);
}

function getPreferredVehicle(): string {
  const value = safeRead<unknown>(STORE.preferredVehicle, '');
  return typeof value === 'string' && value.length < 160 ? value : '';
}
function setPreferredVehicle(id: string) {
  const current = getPreferredVehicle();
  safeWrite(STORE.preferredVehicle, current === id ? '' : id);
  renderGarage();
}
async function renderGarage() {
  notifyModLibrary();
}

let packStatus = new Map<string, string>();

export interface ModLibraryCard {
  id: string; name: string; detail?: string; source?: string; url?: string;
  category?: ModCategory; targetPath?: string;
  status: 'installed' | 'missing' | 'unknown' | 'unchecked';
  favorite: boolean;
}
export interface ModLibrarySnapshot {
  packs: ModLibraryCard[];
  custom: ModLibraryCard[];
  count: number;
  statusText: string;
}
export function getModLibrarySnapshot(): ModLibrarySnapshot {
  const favorites = getFavorites();
  const packs: ModLibraryCard[] = KNOWN_PACKS.map(mod => ({
    id: mod.id, name: mod.name, detail: mod.detail, source: mod.source,
    status: (packStatus.get(mod.id) ?? 'unknown') as ModLibraryCard['status'],
    favorite: favorites.has(mod.id),
  }));
  const custom: ModLibraryCard[] = getCustomMods().map(mod => ({
    id: 'custom:' + mod.id, name: mod.name, url: mod.url,
    category: mod.category ?? 'other', targetPath: mod.targetPath ?? '',
    status: (packStatus.get('custom:' + mod.id) ?? 'unchecked') as ModLibraryCard['status'],
    favorite: favorites.has('custom:' + mod.id),
  }));
  const statusText = modStatusText;
  return { packs, custom, count: custom.length, statusText };
}
export function toggleModLibraryFavorite(id: string): ModLibrarySnapshot {
  const allowed = KNOWN_PACKS.some(mod => mod.id === id) || getCustomMods().some(mod => 'custom:' + mod.id === id);
  if (allowed) { toggleFavorite(id); renderGarage(); }
  return getModLibrarySnapshot();
}
export function removeModLibraryEntry(id: string): ModLibrarySnapshot {
  if (!id.startsWith('custom:')) return getModLibrarySnapshot();
  const rawId = id.slice('custom:'.length);
  const current = getCustomMods();
  if (!current.some(mod => mod.id === rawId)) return getModLibrarySnapshot();
  saveCustomMods(current.filter(mod => mod.id !== rawId));
  const favorites = getFavorites();
  favorites.delete(id);
  saveFavorites(favorites);
  packStatus.delete(id);
  renderGarage();
  return getModLibrarySnapshot();
}
export async function checkModLibraryPacks(): Promise<ModLibrarySnapshot> {
  await checkPacks();
  return getModLibrarySnapshot();
}

type GarageBuildPreference = { paintHex?: string; parts?: Record<string, string> };







export async function importModList(file: File): Promise<string> {
  try {
    if (file.size > 256 * 1024) throw new Error('too large');
    const parsed = JSON.parse(await file.text()) as { schema?: unknown; mods?: unknown };
    if (parsed.schema !== 1 || !Array.isArray(parsed.mods) || parsed.mods.length > 100) throw new Error('shape');
    const accepted: Omit<CustomMod, 'id' | 'createdAt'>[] = [];
    for (const raw of parsed.mods) {
      if (!raw || typeof raw !== 'object') throw new Error('entry');
      const item = raw as Record<string, unknown>;
      if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 || /[\u0000-\u001f\u007f]/.test(item.name) || typeof item.url !== 'string' || !validHttpUrl(item.url)) throw new Error('entry');
      if (item.category !== undefined && !isModCategory(item.category)) throw new Error('category');
      if (item.targetPath !== undefined && item.targetPath !== '' && (typeof item.targetPath !== 'string' || !validRelativeGamePath(item.targetPath))) throw new Error('path');
      accepted.push({ name: item.name.trim(), url: item.url, category: isModCategory(item.category) ? item.category : 'other', targetPath: typeof item.targetPath === 'string' ? normalizeGamePath(item.targetPath) : '' });
    }
    const merged = getCustomMods();
    for (const incoming of accepted) {
      if (merged.some(item => item.name.toLocaleLowerCase() === incoming.name.toLocaleLowerCase() && item.url === incoming.url)) continue;
      if (merged.length >= 100) break;
      merged.push({ ...incoming, id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() });
    }
    if (!saveCustomMods(merged)) throw new Error('storage');
    setModStatus(t('Mod list imported.'));
    renderGarage();
    return modStatusText;
  } catch {
    setModStatus(t('Invalid mod list file.'));
    return modStatusText;
  }
}

async function checkPacks(): Promise<void> {
  try {
    const response = await fetch(`/data-manifest?check=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
    const manifest = await response.json() as { files?: { p?: unknown }[] };
    if (!Array.isArray(manifest.files)) throw new Error('manifest files missing');
    const paths = manifest.files.map(file => typeof file?.p === 'string' ? normalizeGamePath(file.p).toLowerCase() : '').filter(Boolean);
    const has = (wanted: string) => {
      const normalized = normalizeGamePath(wanted).toLowerCase();
      return paths.some(path => path === normalized || (normalized.endsWith('/') && path.startsWith(normalized)));
    };
    for (const mod of KNOWN_PACKS) {
      const found = mod.id === 'mod:turkish' ? mod.paths.every(has) : mod.paths.some(has);
      packStatus.set(mod.id, found ? 'installed' : 'missing');
    }
    for (const mod of getCustomMods())
      packStatus.set(`custom:${mod.id}`, mod.targetPath ? (has(mod.targetPath) ? 'installed' : 'missing') : 'unchecked');
    const languagePacks = LANGUAGE_PACKS.filter(lang => paths.some(path => path.startsWith(`langpacks/${lang}/`)));
    if (languagePacks.length) packStatus.set('mod:languages', 'installed');
    setModStatus(`${t('Detected on server')}: ${[...packStatus.values()].filter(value => value === 'installed').length}`);
  } catch {
    for (const mod of KNOWN_PACKS) packStatus.set(mod.id, 'unknown');
    for (const mod of getCustomMods()) packStatus.set(`custom:${mod.id}`, mod.targetPath ? 'unknown' : 'unchecked');
    setModStatus(t('No server pack manifest is available in this preview.'));
  }
  renderGarage();
}

function getProfiles(): ConfigProfile[] {
  const raw = safeRead<unknown>(STORE.profiles, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is ConfigProfile => !!p && typeof p === 'object' && (p as ConfigProfile).schema === 1 &&
    typeof (p as ConfigProfile).id === 'string' && typeof (p as ConfigProfile).name === 'string' &&
    (p as ConfigProfile).name.length > 0 && (p as ConfigProfile).name.length <= 40 &&
    !!(p as ConfigProfile).values && typeof (p as ConfigProfile).values === 'object' && !Array.isArray((p as ConfigProfile).values)).slice(0, 30);
}
function saveProfiles(profiles: ConfigProfile[]) { return safeWrite(STORE.profiles, profiles.slice(0, 30)); }
function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportModList(): string {
  const mods = getCustomMods().map(({ name, url, category, targetPath }) => ({
    name, url, category: category ?? 'other', targetPath: targetPath ?? '',
  }));
  downloadJSON({ schema: 1, mods }, 'trpolaris-mod-list.json');
  const message = t('Mod list exported.');
  setModStatus(message);
  return message;
}

async function importProfileFile(file: File): Promise<string> {
  try {
    if (file.size > 64 * 1024) throw new Error('too large');
    const value = JSON.parse(await file.text()) as Partial<ConfigProfile>;
    if (value.schema !== 1 || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 40 || !value.values || typeof value.values !== 'object' || Array.isArray(value.values)) throw new Error('shape');
    // Reject unsupported keys and malformed values before anything is persisted locally.
    const entries = Object.entries(value.values as Record<string, unknown>);
    if (!entries.length || entries.length > PROFILE_SETTING_KEYS.length) throw new Error('setting count');
    const allowed = new Set<string>(PROFILE_SETTING_KEYS);
    const values: Record<string, string> = {};
    for (const [key, raw] of entries) {
      if (!allowed.has(key) || typeof raw !== 'string' || raw.length > 128) throw new Error('setting value');
      const checked = checkSetting(key, raw);
      if (!checked?.ok || checked.value.toLowerCase() !== raw.toLowerCase()) throw new Error('invalid setting');
      values[key] = checked.value;
    }
    const profiles = getProfiles(); const name = value.name.trim();
    if (profiles.length >= 30 && !profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('too many');
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const imported: ConfigProfile = { schema: 1, id, name, createdAt: Date.now(), values };
    if (!saveProfiles([...profiles.filter(p => p.name.toLowerCase() !== name.toLowerCase()), imported])) throw new Error('storage');
    return t('Profile imported.');
  } catch {
    return t('Invalid profile file.');
  }
}

function loadAccessibility() {
  applyAccessibility(currentAccessibilityPrefs(), false);
  window.dispatchEvent(new Event('trp-accessibility-changed'));
}
function applyAccessibility(prefs: AccessibilityPrefs, persist = true) {
  document.documentElement.toggleAttribute('data-large-text', prefs.largeText);
  document.documentElement.toggleAttribute('data-reduce-motion', prefs.reduceMotion);
  document.documentElement.toggleAttribute('data-high-contrast', prefs.highContrast);
  if (persist) safeWrite(STORE.accessibility, prefs);
}
async function checkUpdates(): Promise<void> {
  updateStatus = '';
  serverVersion = '—';
  updateReloadAvailable = false;
  notifyPlatform();
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined;
    if (registration) await registration.update().catch(() => {});
    const response = await fetch(`/app-version.json?check=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`version HTTP ${response.status}`);
    const data = await response.json() as { version?: unknown };
    if (typeof data.version !== 'string' || compareBuildVersions(data.version, APP_BUILD_VERSION) === null) throw new Error('invalid version');
    serverVersion = data.version;
    const comparison = compareBuildVersions(data.version, APP_BUILD_VERSION);
    if (comparison === null) throw new Error('unsupported version format');
    if (comparison > 0) { updateStatus = t('Update available. Reload when ready.'); updateReloadAvailable = true; }
    else if (comparison < 0) updateStatus = t('The server build is older than this page.');
    else updateStatus = t("You're up to date.");
  } catch (error) {
    updateStatus = `${t('Version information is not available on this server.')} (${error instanceof Error ? error.message : String(error)})`;
  }
  notifyPlatform();
}

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join('|');
const markupTokens = (value: string) => [...value.matchAll(/<\/?\d+>/g)].map(m => m[0]).sort().join('|');
async function checkTranslations(): Promise<void> {
  translationStatus = '';
  notifyPlatform();
  try {
    const manifestResponse = await fetch(`/i18n-key-manifest.json?check=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
    if (!manifestResponse.ok) throw new Error('Translation key manifest is unavailable; rebuild the web app first.');
    const manifest = await manifestResponse.json() as { key: string; plural?: boolean; one?: string }[];
    if (!Array.isArray(manifest) || manifest.length < 100) throw new Error('Invalid translation key manifest.');
    let missing = 0, malformed = 0, untranslated = 0;
    for (const lang of LANGUAGES.filter(language => language !== 'english')) {
      const response = await fetch(`/lang/${lang}.json?check=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
      if (!response.ok) { missing++; continue; }
      const dict = await response.json() as Record<string, unknown>;
      for (const entry of manifest) {
        const value = dict[entry.key];
        if (value === undefined) { missing++; continue; }
        const forms = typeof value === 'string' ? [value] : value && typeof value === 'object' && entry.plural ? Object.values(value as Record<string, unknown>) : [];
        if (!forms.length || forms.some(item => typeof item !== 'string' || !item.trim())) { malformed++; continue; }
        if (typeof value === 'string' && value === entry.key) untranslated++;
        const source = entry.plural ? `${entry.one ?? ''} ${entry.key}` : entry.key;
        for (const form of forms as string[]) if (placeholders(source) !== placeholders(form) || markupTokens(entry.key) !== markupTokens(form)) malformed++;
      }
      const known = new Set(manifest.map(entry => entry.key));
      if (Object.keys(dict).some(key => !known.has(key))) malformed++;
    }
    const count = `15 languages checked: ${missing} missing entries, ${malformed} formatting issues, ${untranslated} English-identical entries.`;
    translationStatus = missing || malformed ? `${count} Review the reported language files before release.` : `${count} No structural issues found.`;
  } catch (error) {
    translationStatus = error instanceof Error ? error.message : t('Could not check translations.');
  }
  notifyPlatform();
}

function wireFirstRun(settings: SettingsService, log: (line: string) => void): () => Promise<void> {
  const dialog = $<HTMLDialogElement>('#first-run-dialog');
  const languageSelect = $<HTMLSelectElement>('#first-run-language');
  const populate = () => {
    const prior = languageSelect.value;
    const topLanguage = document.querySelector<HTMLSelectElement>('#lang-pick')?.value ?? '';
    languageSelect.replaceChildren(...LANGUAGES.map(l => new Option(NATIVE[l], l)));
    const chosen = LANGUAGES.includes(prior as typeof LANGUAGES[number]) ? prior
      : LANGUAGES.includes(topLanguage as typeof LANGUAGES[number]) ? topLanguage
      : lastLanguage();
    languageSelect.value = chosen;
    for (const option of [...languageSelect.options]) option.lang = LOCALE[option.value as keyof typeof LOCALE];
  };
  populate();
  onLanguage(populate);
  const showFirstRun = async () => {
    populate();
    if (dialog.open) return;
    // Wait for the page's fonts and first layout pass: the automatic first open
    // must have the same measured layout as a dialog opened later by the user.
    try { await document.fonts.ready; } catch { /* system fonts remain usable */ }
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (!dialog.open) {
      dialog.showModal();
      dialog.getBoundingClientRect();
    }
  };
  $<HTMLAnchorElement>('#first-run-settings').onclick = () => dialog.close('settings');
  $<HTMLAnchorElement>('#first-run-diagnostics').onclick = () => dialog.close('diagnostics');
  $<HTMLButtonElement>('#first-run-continue').onclick = async () => {
    const pick = $('#lang-pick') as HTMLSelectElement;
    const wantedLanguage = languageSelect.value;
    const languageChanged = await setLanguage(wantedLanguage, log);
    if (languageChanged) pick.value = wantedLanguage;
    const presetName = ($<HTMLSelectElement>('#first-run-profile')).value;
    const values: Record<string, readonly (readonly [string, string])[]> = {
      performance: [['render', 'scale:0.5'], ['fps', '60'], ['audio_latency', 'balanced']],
      balanced: [['render', 'backing'], ['fps', 'auto'], ['audio_latency', 'balanced']],
      quality: [['render', 'scale:1.5'], ['fps', 'auto'], ['audio_latency', 'interactive']],
    };
    try {
      await settings.applyPreset(presetName === 'quality' ? 'High quality' : presetName === 'performance' ? 'Performance' : 'Balanced', values[presetName]);
    } catch { /* SettingsService logs/announces failures; onboarding stays usable. */ }
    if ($<HTMLInputElement>('#first-run-skip').checked) { try { localStorage.setItem(STORE.onboarding, '1'); } catch { /* optional */ } }
    dialog.close('continue');
  };
  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'settings') location.hash = '#settings';
    else if (dialog.returnValue === 'diagnostics') location.hash = '#system';
    if ($<HTMLInputElement>('#first-run-skip').checked) { try { localStorage.setItem(STORE.onboarding, '1'); } catch { /* optional */ } }
  });
  let alreadySeen = false; try { alreadySeen = localStorage.getItem(STORE.onboarding) === '1'; } catch { /* optional */ }
  if (!alreadySeen && !isAutomatedTest()) setTimeout(() => { void showFirstRun(); }, 900);
  return showFirstRun;
}
function isAutomatedTest(): boolean { return location.search.includes('test=') || location.pathname.startsWith('/test/'); }

/** The selected imported add-on passed to the game runtime when Play is pressed. */
export interface AddonVehicleLaunchInfo {
  typeName: string;
  manufacturer: string;
  name: string;
  /** Raw 0x890-byte native NFSU2 CarTypeInfo record, hex encoded for the WASM runtime. */
  nativeTypeInfoHex?: string;
  ready: boolean;
  reason?: string;
  baseTypeName: string;
  hasGeometryLzc: boolean;
  powerHp?: number;
  basePowerHp?: number;
  topSpeedKmh?: number;
  parts: { category: string; option: string }[];
}


const SETTINGS_PRESETS = {
  performance: { name: 'Performance', values: [['render', 'scale:0.5'], ['fps', '60'], ['audio_latency', 'balanced']] as const },
  balanced: { name: 'Balanced', values: [['render', 'backing'], ['fps', 'auto'], ['audio_latency', 'balanced']] as const },
  quality: { name: 'High quality', values: [['render', 'scale:1.5'], ['fps', 'auto'], ['audio_latency', 'interactive']] as const },
};

export function setupPlatformFeatures(settings: SettingsService, confirm: (title: string, body: string, ok: string, danger?: boolean) => Promise<boolean>, log: (line: string) => void) {
  window.__trpSettingsProfilesBridge = {
    snapshot: () => getProfiles().map(({ id, name, createdAt }) => ({ id, name, createdAt })),
    readOnly: () => settings.readOnly(),
    save: async (rawName: string) => {
      const name = rawName.trim();
      const projectProfiles = () => getProfiles().map(({ id, name, createdAt }) => ({ id, name, createdAt }));
      if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) {
        return { profiles: projectProfiles(), message: t('The profile name must be 1 to 40 printable characters.') };
      }
      const profiles = getProfiles();
      const existing = profiles.find(profile => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      const id = existing?.id ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const record: ConfigProfile = { schema: 1, id, name, createdAt: Date.now(), values: settings.profileValues() };
      if (!saveProfiles([...profiles.filter(profile => profile.id !== id), record])) {
        return { profiles: projectProfiles(), message: t('Could not save the profile.') };
      }
      
      return { profiles: projectProfiles(), message: t('Profile saved.') };
    },
    apply: async (id: string) => {
      const profile = getProfiles().find(item => item.id === id);
      if (!profile) throw new Error('Profile not found');
      const applied = await settings.applyProfileValues(profile.name, profile.values);
      window.dispatchEvent(new Event('trp-settings-changed'));
      return { applied, message: applied
        ? t('Settings profile applied: {name}. Changes apply the next time you press Play.', { name: profile.name })
        : t('The profile could not be applied in this tab.') };
    },
    remove: async (id: string) => {
      const profile = getProfiles().find(item => item.id === id);
      if (!profile) return { removed: false, profiles: getProfiles().map(({ id, name, createdAt }) => ({ id, name, createdAt })) };
      if (!await confirm(t('Delete profile'), `${t('Delete profile')} “${profile.name}”?`, t('Delete profile'), true)) {
        return { removed: false, profiles: getProfiles().map(({ id, name, createdAt }) => ({ id, name, createdAt })) };
      }
      saveProfiles(getProfiles().filter(item => item.id !== profile.id));
      const fav = getFavorites(); fav.delete(`profile:${profile.id}`); saveFavorites(fav);
      
      return { removed: true, profiles: getProfiles().map(({ id, name, createdAt }) => ({ id, name, createdAt })), message: t('Profile deleted.') };
    },
    export: (id: string) => {
      const profile = getProfiles().find(item => item.id === id);
      if (!profile) throw new Error('Profile not found');
      downloadJSON(profile, `trpolaris-profile-${profile.name.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
    },
    import: async (file: File) => {
      const message = await importProfileFile(file);
      return { profiles: getProfiles().map(({ id, name, createdAt }) => ({ id, name, createdAt })), message };
    },
    preset: async (id: string) => {
      const preset = SETTINGS_PRESETS[id as keyof typeof SETTINGS_PRESETS];
      if (!preset) throw new Error('Unsupported settings preset');
      const applied = await settings.applyPreset(preset.name, preset.values);
      window.dispatchEvent(new Event('trp-settings-changed'));
      return { applied, message: t('Settings preset saved: {name}. Changes apply the next time you press Play.', { name: t(preset.name) }) };
    },
  };
  window.dispatchEvent(new Event('trp-settings-profiles-ready'));
  
  loadAccessibility();
  window.__trpAccessibilityBridge = {
    current: () => currentAccessibilityPrefs(),
    set: (key, value) => setAccessibilityPreference(key, value),
  };
  window.dispatchEvent(new Event('trp-accessibility-ready'));
  const clearPreferences = async () => {
    if (!await confirm(t('Clear app preferences'), t('This clears favorites, mod links, saved profiles, preferred vehicle, accessibility and onboarding preferences; game saves and settings are not deleted.'), t('Clear app preferences'), true)) return false;
    for (const key of [STORE.favorites, STORE.customMods, STORE.accessibility, STORE.onboarding, STORE.profiles, STORE.preferredVehicle]) { try { localStorage.removeItem(key); } catch { /* optional */ } }
    loadAccessibility(); renderGarage(); privacyStatus = t('App preferences cleared.');
    window.dispatchEvent(new Event('trp-platform-changed'));
    return true;
  };
  const openFirstRun = wireFirstRun(settings, log);
  onLanguage(() => { renderGarage(); });
  window.__trpModLibraryBridge = {
    snapshot: () => getModLibrarySnapshot(),
    toggleFavorite: id => toggleModLibraryFavorite(id),
    removeCustom: id => removeModLibraryEntry(id),
    addLink: (name, url, category, targetPath) => addCustomModLink(name, url, category, targetPath),
    importList: async file => await importModList(file),
    exportList: () => exportModList(),
    checkPacks: async () => await checkModLibraryPacks(),
  };
  window.dispatchEvent(new Event('trp-mod-library-ready'));
  renderGarage(); 
  window.__trpPlatformBridge = {
    snapshot: () => ({
      currentVersion: APP_BUILD_VERSION,
      serverVersion,
      updateStatus,
      translationStatus,
      privacyStatus,
      reloadAvailable: updateReloadAvailable,
    }),
    checkUpdates: async () => { await checkUpdates(); window.dispatchEvent(new Event('trp-platform-changed')); return window.__trpPlatformBridge!.snapshot(); },
    checkTranslations: async () => { await checkTranslations(); window.dispatchEvent(new Event('trp-platform-changed')); return window.__trpPlatformBridge!.snapshot(); },
    clearPreferences,
    openFirstRun: () => { void openFirstRun(); },
    reload: () => location.reload(),
  };
  window.dispatchEvent(new Event('trp-platform-ready'));
  void checkUpdates().then(() => window.dispatchEvent(new Event('trp-platform-changed')));
}

