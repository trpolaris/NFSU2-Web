// The player-facing page (web/index.html): the start screen and the game.
import './app/style.css';
import './app/modern-theme.css';
import { setupUIEnhancements } from './app/ui-enhancements.js';
import { boot } from './app/shell';

setupUIEnhancements();
void boot();
