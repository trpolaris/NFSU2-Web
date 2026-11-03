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
  interface TrpSettingsBridge {
    current(key: string): string;
    set(key: string, value: string | null): Promise<void>;
    setValidated(key: string, value: string | null): Promise<void>;
    readOnly(): boolean;
    refresh(): Promise<void>;
  }
  interface Window {
    __trpTranslateReact?: (root: ParentNode) => void;
    __trpSettingsBridge?: TrpSettingsBridge;
  }
}

window.__trpTranslateReact = translatePage;
setupUIEnhancements();
void boot();
