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
  interface TrpSettingsOption { value: string; label: string; }
  interface TrpSettingsItem {
    key: string; label: string; help: string; control: string; value: string; inverted: boolean;
    options: TrpSettingsOption[]; min?: number; max?: number; step?: number; unit?: string;
    placeholder: string; preview: boolean; modified: boolean; link: { text: string; href: string } | null;
  }
  interface TrpSettingsRawLine { line: number; key: string; value: string; refused: string; env: string; }
  interface TrpSettingsRawSnapshot {
    ready: boolean; readOnly: boolean; text: string; canResetAll: boolean; other: TrpSettingsRawLine[];
  }
  interface TrpSettingsSnapshot {
    ready: boolean; readOnly: boolean; note: string;
    groups: { title: string; moreLabel: string; items: TrpSettingsItem[] }[];
  }
  interface TrpSettingsProfile { id: string; name: string; createdAt: number; }
  interface TrpSettingsProfilesResult { profiles: TrpSettingsProfile[]; message?: string; }
  interface TrpSettingsProfilesBridge {
    snapshot(): TrpSettingsProfile[];
    readOnly(): boolean;
    save(name: string): Promise<TrpSettingsProfilesResult>;
    apply(id: string): Promise<{ applied: boolean; message: string }>;
    remove(id: string): Promise<{ removed: boolean; profiles: TrpSettingsProfile[]; message?: string }>;
    export(id: string): void;
    import(file: File): Promise<TrpSettingsProfilesResult>;
    preset(id: 'performance' | 'balanced' | 'quality'): Promise<{ applied: boolean; message: string }>;
  }
  interface TrpControlOption { value: string; label: string; }
  interface TrpControlsSnapshot {
    tab: 'keys' | 'pad' | 'site'; family: 'xb' | 'ps'; steering: string;
    steeringOptions: TrpControlOption[]; levelHorizon: boolean;
    touchSize: string; touchSizeOptions: TrpControlOption[];
    menuSize: string; menuSizeOptions: TrpControlOption[];
  }
  interface TrpControlsBridge {
    snapshot(): TrpControlsSnapshot;
    showTab(tab: TrpControlsSnapshot['tab']): void;
    setFamily(family: TrpControlsSnapshot['family']): void;
    setSteering(value: string): void;
    setLevelHorizon(value: boolean): void;
    setTouchSize(value: string): void;
    setMenuSize(value: string): void;
  }
  interface TrpPlatformSnapshot {
    currentVersion: string; serverVersion: string; updateStatus: string;
    translationStatus: string; privacyStatus: string; reloadAvailable: boolean;
  }
  interface TrpPlatformBridge {
    snapshot(): TrpPlatformSnapshot;
    checkUpdates(): Promise<TrpPlatformSnapshot>;
    checkTranslations(): Promise<TrpPlatformSnapshot>;
    clearPreferences(): Promise<boolean>;
    openFirstRun(): void;
    reload(): void;
  }
  interface TrpDiagnosticItem { id: string; state: string; label: string; detail: string; code: string; }
  interface TrpDiagnosticsSnapshot { items: TrpDiagnosticItem[]; busy: boolean; }
  interface TrpDiagnosticsBridge {
    snapshot(): TrpDiagnosticsSnapshot;
    refresh(): Promise<void>;
    download(): void;
  }
  interface TrpGameDataSnapshot {
    info: string; message: string; state: string; busy: boolean; preloading: boolean;
    paused: boolean; progress: number; showPreload: boolean; preloadLabel: string; progressHidden: boolean;
  }
  interface TrpRuntimeProblem { id: string; state: string; label: string; detail: string; code: string; }
  interface TrpRuntimeSnapshot {
    phase: string; headline: string; detail: string; progress: number; canPlay: boolean;
    retryAvailable: boolean; reloadAvailable: boolean; logAvailable: boolean;
    lastGameMessage: string; reportMessage: string; updateMessage: string; overrideMessage: string;
    problems: TrpRuntimeProblem[]; storageWarning: string;
  }
  interface TrpRuntimeBridge {
    snapshot(): TrpRuntimeSnapshot;
    play(): Promise<void>;
    retry(): Promise<void>;
    reload(): Promise<void>;
    downloadLog(): Promise<void>;
  }
  interface TrpSaveProfile { name: string; mtime: number; size: number; }
  interface TrpSavesSnapshot { profiles: TrpSaveProfile[]; busy: boolean; message: string; }
  interface TrpSavesBridge {
    snapshot(): TrpSavesSnapshot;
    rename(from: string, to: string): Promise<{ ok: boolean; message: string }>;
    exportBackup(): Promise<void>;
    importBackup(file: File): Promise<void>;
    gameDataSnapshot(): TrpGameDataSnapshot;
    togglePreload(): Promise<void>;
    clearGameData(): Promise<void>;
    shotsSnapshot(): { path: string; size: number; mtime: number }[];
    shotThumbnail(path: string): Promise<string | null>;
    shotImageUrl(path: string): Promise<string>;
    downloadShot(path: string): void;
    deleteShot(path: string): Promise<boolean>;
    nameMax: number;
  }
  interface TrpVaultSnapshot {
    available: boolean; linked: boolean; phrase: string; revealed: boolean; owner: boolean; busy: boolean; working: boolean;
    host: string; when: string; whenVisible: boolean; claim: string; claimVisible: boolean;
    about: string; aboutVisible: boolean; sides: string; status: string; message: string; messageWarn: boolean;
    makeVisible: boolean; showDownload: boolean; showLoad: boolean; showSync: boolean; showEarlier: boolean;
    showConflict: boolean; showReplaced: boolean; makeDisabled: boolean; loadDisabled: boolean; syncDisabled: boolean;
    earlierDisabled: boolean; keepMineDisabled: boolean; takeTheirsDisabled: boolean; stopDisabled: boolean;
    deleteDisabled: boolean; putBackDisabled: boolean; conflictState: boolean;
  }
  interface TrpVaultBridge {
    snapshot(): TrpVaultSnapshot;
    make(): Promise<boolean>;
    load(phrase: string): Promise<void>;
    toggleVisibility(): void;
    download(): void;
    sync(): Promise<void>;
    goBack(): Promise<void>;
    stop(): Promise<void>;
    remove(): Promise<void>;
    keepMine(): Promise<boolean>;
    takeTheirs(): Promise<boolean>;
    putBack(): Promise<void>;
  }
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
    snapshot(): TrpSettingsSnapshot;
    rawSnapshot(): TrpSettingsRawSnapshot;
    saveRaw(text: string): Promise<string>;
    resetAll(): Promise<boolean>;
    resetOther(line: number, key: string): Promise<void>;
    setOption(key: string, value: string): Promise<void>;
    resetOption(key: string): Promise<void>;
    previewOption(key: string, value: string): Promise<void>;
    stopPreviewOption(key: string): void;
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
    __trpSettingsProfilesBridge?: TrpSettingsProfilesBridge;
    __trpAccessibilityBridge?: TrpAccessibilityBridge;
    __trpSavesBridge?: TrpSavesBridge;
    __trpVaultBridge?: TrpVaultBridge;
    __trpControlsBridge?: TrpControlsBridge;
    __trpPlatformBridge?: TrpPlatformBridge;
    __trpDiagnosticsBridge?: TrpDiagnosticsBridge;
    __trpRuntimeBridge?: TrpRuntimeBridge;
    __trpModLibraryBridge?: TrpModLibraryBridge;
  }
}

window.__trpTranslateReact = translatePage;
setupUIEnhancements();
void boot();
