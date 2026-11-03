// The player-facing page (web/index.html): the start screen and the game.
import './app/style.css';
import './app/modern-theme.css';
import './app/experience.css';
import './app/design-system.css';
import './app/full-redesign.css';
import './app/component-polish.css';
import './app/hub-integration.css';
import { setupUIEnhancements } from './app/ui-enhancements.js';
import { boot } from './app/shell';
import { translatePage } from './app/i18n';

declare global {
  interface TrpModLibraryCard {
    id: string; name: string; detail?: string; source?: string; url?: string;
    category?: string; targetPath?: string; status: 'installed' | 'missing' | 'unknown' | 'unchecked'; favorite: boolean;
  }
  interface TrpModLibrarySnapshot {
    packs: TrpModLibraryCard[]; custom: TrpModLibraryCard[]; count: number; statusText: string;
  }
  interface TrpModLibraryBridge {
    snapshot(): TrpModLibrarySnapshot;
    toggleFavorite(id: string): TrpModLibrarySnapshot;
    removeCustom(id: string): TrpModLibrarySnapshot;
    checkPacks(): Promise<TrpModLibrarySnapshot>;
    addLink(name: string, url: string, category: string, targetPath: string): { ok: boolean; message: string };
    importList(file: File): Promise<string>;
    exportList(): string;
  }
  interface TrpAccessibilityPrefs { largeText: boolean; reduceMotion: boolean; highContrast: boolean; }
  interface TrpAccessibilityBridge {
    current(): TrpAccessibilityPrefs;
    set(key: 'largeText' | 'reduceMotion' | 'highContrast', value: boolean): TrpAccessibilityPrefs;
  }
  interface TrpModLibraryCard {
    id: string; name: string; detail?: string; source?: string; url?: string;
    category?: string; targetPath?: string; status: 'installed' | 'missing' | 'unknown' | 'unchecked'; favorite: boolean;
  }
  interface TrpModLibrarySnapshot {
    packs: TrpModLibraryCard[]; custom: TrpModLibraryCard[]; count: number; statusText: string;
  }
  interface TrpModLibraryBridge {
    snapshot(): TrpModLibrarySnapshot;
    toggleFavorite(id: string): TrpModLibrarySnapshot;
    removeCustom(id: string): TrpModLibrarySnapshot;
    checkPacks(): Promise<TrpModLibrarySnapshot>;
  }
  interface TrpCrew { name: string; rgb: string; }
  interface TrpSettingsBridge {
    current(key: string): string;
    set(key: string, value: string | null): Promise<void>;
    setValidated(key: string, value: string | null): Promise<void>;
    crews(): TrpCrew[];
    crewCount(name: string): number | undefined;
    setCrews(list: TrpCrew[]): Promise<void>;
    quickChat(): { phrases: number[]; groups: string[] };
    saveQuickChat(phrases: number[], groups: string[]): Promise<void>;
    readOnly(): boolean;
    refresh(): Promise<void>;
  }
  interface Window {
    __trpTranslateReact?: (root: ParentNode) => void;
    __trpSettingsBridge?: TrpSettingsBridge;
    __trpAccessibilityBridge?: TrpAccessibilityBridge;
    __trpModLibraryBridge?: TrpModLibraryBridge;
  }
}

window.__trpTranslateReact = translatePage;
setupUIEnhancements();
void boot();
