// settings.ini, read and written for the whole page (the settings panel, Play and in-game menus).
// There are two views:
//  - text: the file as last read or written (what the settings panel shows)
//  - forGame: the file this tab last loaded for a game. A panel refresh must not change a running game's settings.
// A tab that does not own the saves may read the file to show it, but does not write it when Play loads.
// A failed read leaves both views untouched, so a missing/unreadable file is never mistaken for an empty one.
import { readText, writeFile } from './savefs';
import { settingsUpgrade, TEMPLATE } from './settings';

const FILE = 'settings.ini';

export interface SettingsFileIO {
  readText(dir: string, path: string): Promise<string | null>;
  writeFile(dir: string, path: string, text: string): Promise<void>;
}

const DEFAULT_IO: SettingsFileIO = { readText, writeFile };

export class SettingsFile {
  private shown: string | null = null;
  private played: string | null = null;

  /** dir: the save folder (it may change before the page reads it, e.g. a development test page) */
  constructor(
    private readonly dir: () => string,
    private readonly log: (line: string) => void,
    private readonly io: SettingsFileIO = DEFAULT_IO,
  ) {}

  /** The file as last read or written here (null: not read yet, or there is none). */
  get text(): string | null { return this.shown; }

  /** The settings this tab's game last loaded (null: this tab has not loaded them yet). */
  get forGame(): string | null { return this.played; }

  /** Read the file without changing either view. Throws when it could not be read. */
  peek(): Promise<string | null> { return this.io.readText(this.dir(), FILE); }

  /** Read again for the settings panel. Does not change the game view. */
  async read(): Promise<string | null> {
    this.shown = await this.peek();
    return this.shown;
  }

  /** Load settings for a game. Only the save owner creates the template or upgrades an older file. */
  async load(owner: boolean): Promise<string | null> {
    let text = await this.peek();
    if (text === null && owner) {
      text = TEMPLATE;
      await this.io.writeFile(this.dir(), FILE, text);
      this.log('[app] settings: wrote template /save/settings.ini');
    } else if (text !== null && owner) {
      const up = settingsUpgrade(text);
      if (up) {
        text = up.text;
        await this.io.writeFile(this.dir(), FILE, text);
        this.log(`[app] settings: added the new options ${up.added.join(', ')} to /save/settings.ini (commented out, defaults unchanged)`);
      }
    }
    this.played = text;
    return text;
  }

  /** Write the whole file. Both views are updated only after the write succeeds. Returns the previous game view. */
  async write(text: string): Promise<string | null> {
    await this.io.writeFile(this.dir(), FILE, text);
    const previous = this.played;
    this.shown = this.played = text;
    return previous;
  }

  /** Edit the current on-disk file, not a potentially stale cached view. Throws without changing either view on error. */
  async edit(edit: (text: string) => string): Promise<string> {
    const text = edit(await this.peek() ?? TEMPLATE);
    await this.write(text);
    return text;
  }
}
