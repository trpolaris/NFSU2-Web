// The screenshot storage and image decoding service. F12 captures are written into the save folder,
// included in local backups and presented by the React gallery. Thumbnails are queued to avoid
// decoding many large images at once; TGA files are decoded because browsers do not display TGA natively.

import { exists, removePath, saveRoot, writeFile, type Entry } from './savefs';
import { downloadBlob, stamp } from './logs';
import { dateLocale, t } from './i18n';

export interface ShotsDeps {
  saveDir: string;
  confirm(title: string, body: string, ok: string, danger?: boolean): Promise<boolean>;
  /** a screenshot was deleted: the section lists the save folder again */
  changed(): void;
}

/** two rows of four, the newest; the dialog pages through the rest */
const THUMB_W = 384;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', bmp: 'image/bmp', tga: 'image/x-tga' };
const ext = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();
const key = (s: Entry) => `${s.path}|${s.size}|${s.mtime}`;

/** Write an F12 screenshot at the top of the save folder as nfsu2-<date>_<time>.png; returns its name. */
export async function saveScreenshot(saveDir: string, png: Blob, d = new Date()): Promise<string> {
  const base = `nfsu2-${stamp(d)}`;
  let name = `${base}.png`;
  for (let n = 2; await exists(saveDir, name); n++) name = `${base}-${n}.png`;
  await writeFile(saveDir, name, png);
  return name;
}

/**
 * A TGA's pixels: true colour, uncompressed or RLE (types 2 and 10), 24 or 32 bits, either row order.  Alpha is
 * left out (the game's are X8R8G8B8, alpha 0).  null: another kind, or cut short.
 */
export function decodeTga(b: Uint8Array): ImageData | null {
  if (b.length < 18) return null;
  const type = b[2], w = b[12] | b[13] << 8, h = b[14] | b[15] << 8, bpp = b[16], top = (b[17] & 0x20) !== 0;
  if (b[1] !== 0 || (type !== 2 && type !== 10) || (bpp !== 24 && bpp !== 32) || !w || !h) return null;
  const px = bpp >> 3, out = new ImageData(w, h), d = out.data;
  let p = 18 + b[0], x = 0, y = 0, o = top ? 0 : (h - 1) * w * 4;
  const put = (s: number) => {
    d[o] = b[s + 2]; d[o + 1] = b[s + 1]; d[o + 2] = b[s]; d[o + 3] = 255; o += 4;
    if (++x === w) { x = 0; y++; o = (top ? y : h - 1 - y) * w * 4; }
  };
  if (type === 2) {
    if (p + w * h * px > b.length) return null;
    for (; y < h; p += px) put(p);
    return out;
  }
  while (y < h) {
    if (p >= b.length) return null;
    const c = b[p++], n = (c & 127) + 1;
    if (p + (c & 128 ? 1 : n) * px > b.length) return null;
    if (c & 128) { for (let i = 0; i < n && y < h; i++) put(p); p += px; }
    else for (let i = 0; i < n && y < h; i++, p += px) put(p);
  }
  return out;
}

/** "Today, 14:03", "Yesterday, 22:17", "20 Oct, 21:44" (with the year when it is not this one) */
export function when(at: number, now = new Date()): string {
  const d = new Date(at), time = d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const ago = Math.round((day(now) - day(d)) / 864e5);
  if (ago === 0) return t('Today, {time}', { time });
  if (ago === 1) return t('Yesterday, {time}', { time });
  const year = d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {};
  return `${d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', ...year })}, ${time}`;
}

async function fileOf(saveDir: string, name: string): Promise<File> {
  return (await (await saveRoot(saveDir, false)).getFileHandle(name)).getFile();
}

/** a screenshot decoded (resizeWidth: made that wide on the way) */
async function bitmap(saveDir: string, name: string, resizeWidth?: number): Promise<ImageBitmap> {
  const f = await fileOf(saveDir, name);
  const o: ImageBitmapOptions = resizeWidth ? { resizeWidth, resizeQuality: 'medium' } : {};
  if (ext(name) !== 'tga') return createImageBitmap(f, o);
  const img = decodeTga(new Uint8Array(await f.arrayBuffer()));
  if (!img) throw new Error('not a TGA this page reads');
  return createImageBitmap(img, o);
}

async function encode(bmp: ImageBitmap, type: string): Promise<Blob> {
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  return c.convertToBlob({ type, quality: 0.85 });
}

export class ScreenshotsPart {
  private shots: Entry[] = [];
  private thumbs = new Map<string, Promise<string | null>>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private deps: ShotsDeps) {}
  snapshot() { return this.shots.map(({ path, size, mtime }) => ({ path, size, mtime })); }
  thumbnail(path: string): Promise<string | null> {
    const shot = this.shots.find(item => item.path === path);
    return shot ? this.thumb(shot) : Promise.resolve(null);
  }
  async imageUrl(path: string): Promise<string> {
    const shot = this.shots.find(item => item.path === path);
    if (!shot) throw new Error('Screenshot no longer exists');
    const file = ext(path) === 'tga' ? await encode(await bitmap(this.deps.saveDir, path), 'image/png') : await fileOf(this.deps.saveDir, path);
    return URL.createObjectURL(file);
  }
  downloadFromReact(path: string) {
    const shot = this.shots.find(item => item.path === path);
    if (!shot) return;
    void fileOf(this.deps.saveDir, shot.path).then(file => downloadBlob(file, shot.path, MIME[ext(shot.path)]));
  }
  async deleteFromReact(path: string): Promise<boolean> {
    const shot = this.shots.find(item => item.path === path);
    if (!shot) return false;
    if (!await this.deps.confirm(t('Delete this screenshot?'), t('{file} goes from this browser. A backup you downloaded keeps its copy.', { file: shot.path }), t('Delete'), true)) return false;
    try { await removePath(this.deps.saveDir, shot.path); }
    catch (error) { throw new Error(t('It was not deleted: {error}', { error: String(error) })); }
    this.shots = this.shots.filter(item => item.path !== shot.path);
    this.pruneThumbnails();
    this.deps.changed();
    return true;
  }
  show(files: Entry[]) {
    this.shots = [...files].sort((a, b) => b.mtime - a.mtime || (a.path < b.path ? 1 : -1));
    this.pruneThumbnails();
  }
  private pruneThumbnails() {
    const keep = new Set(this.shots.map(key));
    for (const [k, pending] of this.thumbs) {
      if (keep.has(k)) continue;
      this.thumbs.delete(k);
      void pending.then(url => { if (url) URL.revokeObjectURL(url); });
    }
  }
  private thumb(s: Entry): Promise<string | null> {
    let pending = this.thumbs.get(key(s));
    if (!pending) {
      pending = this.queue.then(() => bitmap(this.deps.saveDir, s.path, THUMB_W))
        .then(bmp => encode(bmp, 'image/jpeg')).then(blob => URL.createObjectURL(blob), () => null);
      this.queue = pending;
      this.thumbs.set(key(s), pending);
    }
    return pending;
  }
}
