// In-game F9 Crew DOM controls. These remain an isolated compatibility island for the active game menu.
import { checkCrew, CREW_BIG, CREW_COLOUR_NAMES, CREW_MAX, CREW_PALETTE, freeColour, type Crew } from './crews';
import { roomHash } from './players';
import { t } from './i18n';

function iconButton(cls: string, name: string, path: string): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.className = `icon-btn ${cls}`;
  b.setAttribute('aria-label', name); b.title = name;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path);
  svg.append(p); b.append(svg);
  return b;
}
const PLUS = 'M12 5v14M5 12h14', CROSS = 'M6 6l12 12M18 6L6 18', PERSON = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7';

/** What a crews control shows and does: the Crews row's, and the page menu's while a game is in free roam */
export interface CrewControl {
  /** the crews now, in the player's order, with their colours */
  list: readonly Crew[];
  /** the field's id (a label names it), and the label's (it names the list too) */
  id: string; labelId: string;
  placeholder: string;
  /** how many are in free roam in each crew, by hash (none: not shown) */
  counts?: Map<number, number>;
  /** what the field held when it was last drawn, and each change of it */
  draft: string; onDraft(v: string): void;
  /** the crews after a Leave, a Join or a colour picked; focus(root): where the keyboard goes once they are drawn
   *  again in root */
  change(list: Crew[], focus: (root: HTMLElement) => Element | null | undefined): void;
}

/**
 * A crews control into ctl: one line of pills that wraps, a chip per crew in the player's order (its colour in the
 * game, a button that opens the palette under the line; its name, how many are in free roam in it when the server
 * says, and Leave), then a value box with Join in it (or Enter).  Join waits for a name that can join (crews.ts checkCrew), and the note
 * under the box says why one cannot; with 4 crews the box waits for one to be left.  A Leave keeps the others'
 * colours; a Join takes the first colour no crew has.  A line under the chips names a crew counted with more than
 * CREW_BIG players (showCrewCounts).  Returns the box's field.
 */
export function crewControl(o: CrewControl, ctl: HTMLElement): HTMLInputElement {
  const list = o.list;
  const ul = document.createElement('ul'); ul.className = 'crews'; ul.setAttribute('aria-labelledby', o.labelId);
  list.forEach((c, i) => {
    const li = document.createElement('li'); li.className = 'crew'; li.dataset.hash = String(roomHash(c.name)); li.title = c.name;
    li.style.setProperty('--crew', `#${c.rgb}`);
    const what = t('Colour of {name}', { name: c.name }), change = t('Change the colour of {name}', { name: c.name });
    const dot = document.createElement('button'); dot.type = 'button'; dot.className = 'crew-dot';
    dot.setAttribute('aria-label', change); dot.title = change; dot.setAttribute('aria-expanded', 'false');
    dot.onclick = () => palette(dot, c, i, what);
    const text = document.createElement('span'); text.className = 'crew-text';
    const nm = document.createElement('span'); nm.className = 'crew-name'; nm.textContent = c.name;
    const n = document.createElement('span'); n.className = 'crew-count';
    text.append(nm, n);
    const leave = iconButton('crew-leave', t('Leave crew {name}', { name: c.name }), CROSS);
    // the keyboard goes on to the next crew's Leave (the last one's: the one before), or to the box
    leave.onclick = () => o.change(list.filter((_, k) => k !== i), root => root.querySelectorAll('.crew-leave')[Math.min(i, list.length - 2)]);
    li.append(dot, text, leave);
    ul.append(li);
  });
  const line = document.createElement('div'); line.className = 'crew-line';
  /** crew i's palette, under the line (the chips stay where they are), one open at a time: a radio group of the 8
   *  colours, its own marked; the arrows move along it, Enter, Space or a tap picks one and closes it, Esc (or the dot
   *  again) closes it.  Esc stays here: in the menu's Crews popup it does not close the popup too. */
  const palette = (dot: HTMLButtonElement, c: Crew, i: number, what: string) => {
    const was = ctl.querySelector<HTMLElement>('.crew-colours');
    was?.remove();
    for (const d of ul.querySelectorAll('.crew-dot')) d.setAttribute('aria-expanded', 'false');
    if (was?.dataset.crew === String(i)) { dot.focus(); return; }
    const g = document.createElement('div'); g.className = 'crew-colours'; g.id = `${o.id}-colours`; g.dataset.crew = String(i);
    g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', what);
    dot.setAttribute('aria-controls', g.id); dot.setAttribute('aria-expanded', 'true');
    const close = () => { g.remove(); dot.setAttribute('aria-expanded', 'false'); dot.focus(); };
    const sw = CREW_PALETTE.map((rgb, k) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(rgb === c.rgb)); b.tabIndex = rgb === c.rgb ? 0 : -1;
      const name = t(CREW_COLOUR_NAMES[k]); b.setAttribute('aria-label', name); b.title = name;
      b.style.setProperty('--sw', `#${rgb}`);
      b.onclick = () => {
        if (rgb === c.rgb) { close(); return; }
        o.change(list.map((x, j) => j === i ? { ...x, rgb } : x), root => root.querySelectorAll('.crew-dot')[i]);
      };
      return b;
    });
    if (!sw.some(b => b.tabIndex === 0)) sw[0].tabIndex = 0;          // a colour from the file the palette lacks
    g.onkeydown = e => {
      const at = sw.indexOf(document.activeElement as HTMLButtonElement);
      const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? at - 1
        : e.key === 'Home' ? 0 : e.key === 'End' ? sw.length - 1 : null;
      if (to !== null) {
        e.preventDefault();
        const next = sw[(to + sw.length) % sw.length];
        for (const b of sw) b.tabIndex = b === next ? 0 : -1;
        next.focus();
      } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    };
    g.append(...sw);
    line.after(g);
    sw.find(b => b.tabIndex === 0)!.focus();
  };
  const big = document.createElement('p'); big.className = 'set-note warn crews-big'; big.hidden = true;
  const box = document.createElement('div'); box.className = 'crew-add';
  const inp = document.createElement('input'); inp.type = 'text'; inp.id = o.id; inp.placeholder = t(o.placeholder);
  inp.autocomplete = 'off'; inp.spellcheck = false; inp.enterKeyHint = 'done';
  inp.value = o.draft;
  const join = iconButton('crew-join', t('Join crew'), PLUS);
  const note = document.createElement('p'); note.className = 'set-note'; note.id = `${o.id}-note`; note.setAttribute('aria-live', 'polite');
  const check = () => {
    const r = checkCrew(inp.value, list.map(c => c.name)), full = list.length >= CREW_MAX;
    inp.disabled = full; join.disabled = !r.ok;
    const why = r.ok || !r.why ? '' : t(r.why, { name: r.name ?? '' });
    note.textContent = why || (list.length ? '' : t('No crew yet? Agree on a name with your friends and each type it here, or open a crew\'s invite link.'));
    note.classList.toggle('warn', !!why && !full);
    return r;
  };
  const add = () => {
    const r = check();
    if (!r.ok) return;
    o.onDraft('');
    // the keyboard stays in the box for one more (with 4: on the last crew's Leave)
    o.change([...list, { name: r.name, rgb: freeColour(list) }], root => root.querySelector('.crew-add input:enabled') ?? [...root.querySelectorAll('.crew-leave')].pop());
  };
  inp.oninput = () => { o.onDraft(inp.value); check(); };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  join.onclick = add;
  box.append(inp, join);
  // Keep the list inside its own wrapper: when there are no crews, an empty UL must not occupy a full row.
  const chips = document.createElement('div'); chips.className = 'crew-chips';
  chips.append(ul);
  line.append(chips, box);
  ctl.append(line, big, note);
  if (o.counts) showCrewCounts(ctl, o.counts);
  check();
  return inp;
}

/** the counts on a crews control's chips: a figure by a person's outline (a screen reader gets "{n} in free roam"), the
 *  chip's tooltip its name and that; nothing for a crew counts lacks.  Under the chips, the crews counted with more
 *  than CREW_BIG: the server's hub no longer links them first (in one room; the count is of every room). */
export function showCrewCounts(root: ParentNode, counts: Map<number, number>) {
  for (const ul of root.querySelectorAll<HTMLElement>('ul.crews')) {
    const line = ul.closest('.crew-line')?.parentElement?.querySelector<HTMLElement>('.crews-big');
    if (!line) continue;
    const big = [...ul.querySelectorAll<HTMLElement>('.crew[data-hash]')].filter(li => (counts.get(Number(li.dataset.hash)) ?? 0) > CREW_BIG)
      .map(li => t('{name} has more than 64 players in free roam: in a crew that big, crew-mates far away no longer always show, only the ones nearby, as with everyone else. A less common name works better.',
        { name: li.querySelector('.crew-name')?.textContent ?? '' }));
    line.textContent = big.join(' '); line.hidden = !big.length;
  }
  for (const li of root.querySelectorAll<HTMLElement>('.crew[data-hash]')) {
    const n = counts.get(Number(li.dataset.hash)), el = li.querySelector('.crew-count')!, name = li.querySelector('.crew-name')!.textContent ?? '';
    if (n === undefined) { el.replaceChildren(); li.title = name; continue; }
    const said = t('{n} in free roam', { n });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', PERSON); svg.append(p);
    const fig = document.createElement('span'); fig.setAttribute('aria-hidden', 'true'); fig.textContent = String(n);
    const sr = document.createElement('span'); sr.className = 'vh'; sr.textContent = said;
    el.replaceChildren(svg, fig, sr);
    li.title = `${name} · ${said}`;
  }
}

/** an option's label in the page's language (a language: its name there, and its own name beside it) */
