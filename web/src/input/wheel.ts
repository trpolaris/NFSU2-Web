// Steering wheels (Logitech G29 and the like) through the Gamepad API, for the game's virtual pad (gamepad.ts):
// the wheel becomes the left stick's x, the gas and brake pedals the right and left triggers, the D-pad and buttons
// the pad's, and the game is offered a driving device for it (runtime/dinput_pad.c), whose steering follows the
// wheel's position as the PC game's own wheel support did.
//
// No browser maps a wheel: Chrome, Firefox and Safari give it mapping "", its axes and buttons as its HID report
// descriptor has them, and each browser places those axes in Gamepad.axes its own way (Placement).  So for the
// models whose descriptor is known (ModelAxes: Logitech's G29, G920 and G923, G25, G27, Driving Force GT) the page
// takes the wheel and each pedal from it, placed as the browser does; for any other wheel, or where the wheel shows
// a number of axes its descriptor does not explain or its axes do not sit where it puts them (a driver's settings,
// G HUB's combined pedals), it guesses from where the axes sit when the wheel shows up.  A pedal rests at one end
// of its axis (+1 on Logitech's, which report a released pedal as 255), so read as a stick it held the stick down:
// the bug this file fixed first.  The player can teach the page the right layout (WheelLearn, in the Controls
// sheet: turn the wheel, press each pedal), kept in this browser per model.  A shifter on the wheel (Logitech's
// Driving Force Shifter, the G25's and G27's) shows its gears as buttons; the game's gearbox only shifts up and down,
// so a move of the lever into a gear is one shift up or down, or the lever holds the handbrake (Shifter), as the
// player picks in the same sheet.

import { PAD_A, PAD_B, PAD_BACK, PAD_DDOWN, PAD_DLEFT, PAD_DRIGHT, PAD_DUP, PAD_HOME, PAD_LB, PAD_LS, PAD_RB, PAD_RS,
  PAD_START, PAD_X, PAD_Y } from './proto';

/** a pedal: its axis, its value let go and pressed to the floor (gas and brake on one axis: the two halves) */
export interface Pedal { axis: number; rest: number; full: number; pad?: string }
/** how a wheel's axes and buttons make the pad */
export interface WheelMap {
  steer: number;                 // the wheel's axis
  centre: number;                // its value straight ahead
  lock: number;                  // how far from the centre is full lock to the right (negative: the axis runs the other way)
  gas: Pedal | null;
  brake: Pedal | null;
  buttons: number[];             // buttons[i]: the PAD_* button i is (-1: none)
  gears?: number[];              // the shifter's buttons: 1st to 6th gear, then reverse (-1: none); absent: no shifter
  dpad?: [number, number];       // a hat switch read as two axes, x and y (Linux), where known
  placed?: Placement;            // from the model's descriptor, its axes placed so; absent: guessed
  learned?: boolean;             // set up by the player (WheelLearn), not guessed
}

/** a HID axis by its usage on the Generic Desktop page ('hat': the hat switch, the D-pad) */
export type Usage = 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz' | 'slider' | 'dial' | 'hat';
/** a model's axes: those of its HID report descriptor, in the descriptor's order where that is known (listed), and
 *  which is the wheel and which each pedal */
export interface ModelAxes { axes: Usage[]; listed: boolean; steer: Usage; gas: Usage; brake: Usage; clutch?: Usage }

/**
 * Where a browser puts a wheel's axes in Gamepad.axes (Chromium device/gamepad, Firefox dom/gamepad, WebKit
 * platform/gamepad/mac):
 *   usage   Chrome on Windows and macOS, Firefox on Windows: at its usage less X's: X 0, Y 1, Z 2, Rx 3, Ry 4, Rz 5,
 *           Slider 6, the hat switch 9 (one axis: hatDirs)
 *   kernel  Chrome and Firefox on Linux (joydev, evdev): the axes Linux made of them one after another in the order
 *           of its codes (ABS_X, Y, Z, RX, RY, RZ, THROTTLE the slider), the hat switch two (ABS_HAT0X and HAT0Y)
 *   listed  Firefox on macOS: in the descriptor's order, X to Rz and the hat switch (one axis)
 *   tree    Safari: in the descriptor's order, X to Rz; no hat switch, so no D-pad
 * A known model's axes are placed the one way that gives as many axes as the wheel shows.
 */
export type Placement = 'usage' | 'kernel' | 'listed' | 'tree';
const PLACEMENTS: Placement[] = ['usage', 'kernel', 'listed', 'tree'];
const USAGE_AT: Record<Usage, number> = { x: 0, y: 1, z: 2, rx: 3, ry: 4, rz: 5, slider: 6, dial: 7, hat: 9 };
const KERNEL_CODE: Record<Usage, number> = { x: 0, y: 1, z: 2, rx: 3, ry: 4, rz: 5, slider: 6, dial: 7, hat: 16 };

/** each of the model's axes' index when placed so (a hat switch read as two: its x, y after it), and how many axes
 *  the browser shows then; null for a placement in the descriptor's order where that order is not known */
export function placeAxes(m: ModelAxes, p: Placement): { at: Partial<Record<Usage, number>>; length: number } | null {
  const at: Partial<Record<Usage, number>> = {};
  let length = 0;
  if (p === 'usage') for (const u of m.axes) { at[u] = USAGE_AT[u]; length = Math.max(length, USAGE_AT[u] + 1); }
  else if (p === 'kernel') {
    for (const u of [...m.axes].sort((a, b) => KERNEL_CODE[a] - KERNEL_CODE[b])) { at[u] = length; length += u === 'hat' ? 2 : 1; }
  } else if (!m.listed) return null;
  else for (const u of m.axes) if (u !== 'slider' && u !== 'dial' && (u !== 'hat' || p === 'listed')) at[u] = length++;
  return { at, length };
}

// The descriptors known.  The G29's, the G923's for PlayStation, the G27's and the G25's: the hat switch, X the
// wheel, then one input of three bytes, the gas, brake and clutch pedals, as Z, Rz and Y (sonik-br/lgff_wheel_adapter
// usb_descriptors.h; Linux's hid-lg4ff and SDL's lg4ff driver read those bytes as gas, brake, clutch).
const ZRY: ModelAxes = { axes: ['hat', 'x', 'z', 'rz', 'y'], listed: true, steer: 'x', gas: 'z', brake: 'rz', clutch: 'y' };
// The G920's and the G923's for Xbox: X the wheel, Y the gas, Z the brake, Rz the clutch (Wine's winebus.sys,
// bus_sdl.c g920_absolute_usages, as Windows shows it); the order its descriptor lists them in is not known.
const YZR: ModelAxes = { axes: ['x', 'y', 'z', 'rz', 'hat'], listed: false, steer: 'x', gas: 'y', brake: 'z', clutch: 'rz' };
// The Driving Force GT's: the hat switch, X the wheel, Y the gas, Z the brake.
const DFGT: ModelAxes = { axes: ['hat', 'x', 'y', 'z'], listed: true, steer: 'x', gas: 'y', brake: 'z' };
// Fanatec wheel bases in PC mode. The CSL DD descriptor is known; older bases share a simpler axis layout.
// Pedals connected through the base are supported by this first port; separate USB pedals are deferred.
const FTEC: ModelAxes = { axes: ['hat', 'x', 'z', 'rz', 'y', 'rx', 'ry', 'slider', 'dial'], listed: true,
  steer: 'x', gas: 'z', brake: 'rz', clutch: 'y' };
const FTEC_LATER: ModelAxes = { ...FTEC, listed: false };
const FTEC_V2: ModelAxes = { axes: ['hat', 'x', 'y', 'rz', 'slider'], listed: false,
  steer: 'x', gas: 'y', brake: 'rz', clutch: 'slider' };

/** a wheel model: its USB ids, its buttons' layout (G29 family: PlayStation, G920 family: Xbox), its rotation, its
 *  axes where its descriptor is known, and where its buttons are known to differ from its layout's, they (buttons:
 *  as WheelMap's); gears: its shifter's buttons, 1st to 6th gear and reverse, where known */
export interface WheelInfo {
  vendor: string; product: string; layout: 'ps' | 'xbox' | 'generic'; degrees: number; axes?: ModelAxes;
  buttons?: readonly number[]; gears?: readonly number[];
}

/** the game's full lock, in degrees of a wheel turned from lock to lock, where the model's rotation is known: an
 *  arcade game's steering is quick, and a G29 turned half of its 900 degrees for full lock is a chore */
export const DEFAULT_LOCK_DEGREES = 270;

// the buttons in the order the G29 and G923 (PlayStation) report them (lgff_wheel_adapter reports.h g29_report_t,
// as SDL's lg4ff driver reads them; every browser keeps a wheel's buttons in their usages' order): Cross, Square,
// Circle, Triangle, the right and left paddles (R1, L1), R2, L2, Share, Options, R3, L3, the shifter's six gears and
// reverse, plus, minus, the red dial clockwise and back, its Enter, PS.  The G920 and G923 (Xbox): A, B, X, Y, the
// right and left paddles, Menu, View, the right and left stick buttons, Xbox.  Plus and minus shift too, the dial
// and Enter work the menus.  The shifter's gears are none of the pad's: Shifter makes them shifts.
const PS_BUTTONS = [PAD_A, PAD_X, PAD_B, PAD_Y, PAD_RB, PAD_LB, -1, -1, PAD_BACK, PAD_START, PAD_RS, PAD_LS,
  -1, -1, -1, -1, -1, -1, -1, PAD_RB, PAD_LB, PAD_DDOWN, PAD_DUP, PAD_A, PAD_HOME];
const XBOX_BUTTONS = [PAD_A, PAD_B, PAD_X, PAD_Y, PAD_RB, PAD_LB, PAD_START, PAD_BACK, PAD_RS, PAD_LS, PAD_HOME];
// any other wheel: as the standard mapping's order (gamepad.ts BUTTON_OF), its triggers' places left out
const GENERIC_BUTTONS = [PAD_A, PAD_B, PAD_X, PAD_Y, PAD_LB, PAD_RB, -1, -1, PAD_BACK, PAD_START, PAD_LS, PAD_RS,
  PAD_DUP, PAD_DDOWN, PAD_DLEFT, PAD_DRIGHT, PAD_HOME];
// The G25's and G27's (lgff_wheel_adapter g25_report_t, g27_report_t): twelve buttons in the G29's order, the right
// paddle fifth, then the shifter's gears (the G25's reverse after them, the G27's four more wheel buttons first and
// its reverse last), which the generic table made the D-pad and the page's menu.  Their buttons are unlabelled: the
// generic table's, but for the paddles.
const G25_BUTTONS = [PAD_A, PAD_B, PAD_X, PAD_Y, PAD_RB, PAD_LB, -1, -1, PAD_BACK, PAD_START, PAD_LS, PAD_RS];
// The Driving Force GT's (dfgt_report_t), a PlayStation wheel: the G29's twelve, then its sequential shifter pulled
// back (+, up) and pushed forward (-, down), Enter, plus, the dial clockwise and back, minus, the horn, PS.
const DFGT_BUTTONS = [...PS_BUTTONS.slice(0, 12), PAD_RB, PAD_LB, PAD_A, PAD_RB, PAD_DDOWN, PAD_DUP, PAD_LB, PAD_LS, PAD_HOME];
const FTEC_BUTTONS = [PAD_X, PAD_A, PAD_B, PAD_Y, PAD_RB, PAD_LB, -1, -1, PAD_BACK, PAD_START, PAD_RS, PAD_LS,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, PAD_HOME, -1, -1, -1, -1, -1, -1, PAD_LB, PAD_RB];
const FTEC_PORSCHE_BUTTONS = [-1, PAD_LS, -1, PAD_RS, PAD_X, PAD_A, PAD_Y, PAD_B, PAD_LB, PAD_RB, PAD_BACK, PAD_START];
// the shifter's buttons, 1st to 6th gear and reverse: the G29's and G923's (PlayStation) after their first twelve;
// the G920's one further on (Logitech's table of the Driving Force Shifter's buttons); the G25's as the G29's, the
// G27's reverse alone at the end
const range = (from: number) => Array.from({ length: 7 }, (_, i) => from + i);
const PS_GEARS = range(12), G920_GEARS = range(13), G27_GEARS = [...range(12).slice(0, 6), 22];
const FTEC_GEARS = [...range(13).slice(0, 6), 12];

// the wheels SDL knows (src/joystick/SDL_joystick.c, initial_wheel_devices): vendor:product -> layout, rotation, axes
const LOGI_PS = { layout: 'ps', degrees: 900 } as const, LOGI_XB = { layout: 'xbox', degrees: 900 } as const;
const G29 = { ...LOGI_PS, gears: PS_GEARS }, G920 = { ...LOGI_XB, gears: G920_GEARS };
const FTEC_BASE = { layout: 'generic', axes: FTEC_LATER, buttons: FTEC_BUTTONS, gears: FTEC_GEARS } as const;
const FTEC_OLD = { layout: 'generic', axes: FTEC_V2, buttons: FTEC_PORSCHE_BUTTONS, degrees: 900 } as const;
const KNOWN: Record<string, Omit<WheelInfo, 'vendor' | 'product'>> = {
  '046d:c24f': { ...G29, axes: ZRY }, '046d:c260': G29,                 // G29 (PS3 mode, PS4 mode)
  '046d:c266': { ...G29, axes: ZRY }, '046d:c267': { ...G29, axes: ZRY },   // G923 for PlayStation and PC
  '046d:c268': { layout: 'ps', degrees: 1080 }, '046d:c269': { layout: 'ps', degrees: 1080 },   // PRO Racing Wheel
  '046d:c261': G920, '046d:c262': { ...G920, axes: YZR },               // G920 (Xbox mode, then the PC's)
  '046d:c26d': LOGI_XB, '046d:c26e': { ...LOGI_XB, axes: YZR },         // G923 for Xbox
  '046d:c272': { layout: 'xbox', degrees: 1080 },                      // PRO Racing Wheel for Xbox
  '046d:c294': { layout: 'generic', degrees: 0 },                      // a Logitech wheel before its driver switched it
  '046d:c295': { layout: 'generic', degrees: 0 }, '046d:ca03': { layout: 'generic', degrees: 0 },   // MOMO
  '046d:c298': { layout: 'generic', degrees: 900 },                    // Driving Force Pro
  '046d:c299': { layout: 'generic', degrees: 900, axes: ZRY, buttons: G25_BUTTONS, gears: PS_GEARS },    // G25
  '046d:c29b': { layout: 'generic', degrees: 900, axes: ZRY, buttons: G25_BUTTONS, gears: G27_GEARS },   // G27
  '046d:c29a': { layout: 'ps', degrees: 900, axes: DFGT, buttons: DFGT_BUTTONS },                        // Driving Force GT
  '0eb7:0020': { ...FTEC_BASE, axes: FTEC, degrees: 2520 },                         // CSL DD, Gran Turismo DD Pro, ClubSport DD
  '0eb7:0006': { ...FTEC_BASE, degrees: 2520 }, '0eb7:0007': { ...FTEC_BASE, degrees: 2520 }, // Podium DD1, DD2
  '0eb7:0e03': { ...FTEC_BASE, degrees: 1080 }, '0eb7:0005': { ...FTEC_BASE, degrees: 1080 }, // CSL Elite
  '0eb7:0004': { ...FTEC_BASE, degrees: 900 },                                      // ClubSport V2.5
  '0eb7:0001': { ...FTEC_OLD, buttons: FTEC_BUTTONS, gears: FTEC_GEARS },            // ClubSport V2
  '0eb7:038e': { ...FTEC_OLD, buttons: FTEC_BUTTONS, gears: FTEC_GEARS },            // ClubSport V1
  '0eb7:0197': { ...FTEC_OLD, gears: PS_GEARS }, '0eb7:0011': FTEC_OLD,               // Porsche wheels, CSR Elite
};
// whole vendors that make wheels and little else: Thrustmaster's wheel bases, Fanatec, Simagic, Simucube, Moza ...
const WHEEL_IDS = new Set(['044f:b65d', '044f:b65e', '044f:b664', '044f:b669', '044f:b66d', '044f:b66e', '044f:b66f',
  '044f:b677', '044f:b67f', '044f:b691', '044f:b692', '044f:b696', '045e:02a2', '0483:0522', '0483:a355', '0079:1864',
  '11ff:0511', '1209:ffb0', '3416:0301', '3416:0302']);
const WHEEL_VENDORS = new Set(['16d0', '2433', '346e']);
const NOT_WHEEL = /\b(pedals?|shifter|handbrake|hand brake|button ?box)\b/i;

/** the USB vendor and product from Gamepad.id: Chrome writes "Name (... Vendor: 046d Product: c24f)", Firefox
 *  "046d-c24f-Name" */
export function usbIds(id: string): { vendor: string; product: string } | null {
  const c = /Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i.exec(id) ?? /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i.exec(id);
  return c ? { vendor: c[1].toLowerCase().padStart(4, '0'), product: c[2].toLowerCase().padStart(4, '0') } : null;
}

/** whether Gamepad.id is a steering wheel's, and which (asked every frame: kept per id) */
const seenIds = new Map<string, WheelInfo | null>();
export function wheelOf(id: string): WheelInfo | null {
  let w = seenIds.get(id);
  if (w !== undefined) return w;
  const u = usbIds(id), key = u ? `${u.vendor}:${u.product}` : '';
  const k = KNOWN[key];
  w = k ? { vendor: u!.vendor, product: u!.product, ...k }
    : (u && (WHEEL_IDS.has(key) || (WHEEL_VENDORS.has(u.vendor) && !NOT_WHEEL.test(id)))) || /\bwheel\b|driving force|steering/i.test(id)
    ? { vendor: u?.vendor ?? '', product: u?.product ?? '', layout: 'generic', degrees: 0 } : null;
  if (seenIds.size < 64) seenIds.set(id, w);
  return w;
}

/** whether an axis value is a hat switch read as one axis, let go (it reads outside -1..1 then) */
/** pedals on their own USB: their axes by usage and where a released pedal reads */
export interface PedalSet { axes: Usage[]; gas: Usage; brake: Usage; rest: number }
const FTEC_USB_PEDALS: PedalSet = { axes: ['x', 'y', 'z', 'rx'], gas: 'x', brake: 'y', rest: -1 };
const PEDAL_SETS: Record<string, PedalSet> = {
  '0eb7:183b': FTEC_USB_PEDALS, '0eb7:6204': FTEC_USB_PEDALS, '0eb7:6205': FTEC_USB_PEDALS, '0eb7:6206': FTEC_USB_PEDALS,
  '0eb7:1a95': FTEC_USB_PEDALS, '0eb7:1839': { axes: ['rx', 'ry', 'rz'], gas: 'rx', brake: 'ry', rest: 1 },
};
export function pedalSetOf(id: string): PedalSet | null {
  const u = usbIds(id);
  return (u && PEDAL_SETS[`${u.vendor}:${u.product}`]) || null;
}
export function isPedals(id: string): boolean {
  return !!pedalSetOf(id) || (/\bpedals?\b/i.test(id) && !wheelOf(id));
}
export function pedalsOf(id: string, set: PedalSet, n: number): { gas: Pedal; brake: Pedal } {
  const at = (u: Usage) => n > USAGE_AT[u] ? USAGE_AT[u] : set.axes.indexOf(u);
  const p = (u: Usage): Pedal => ({ axis: at(u), rest: set.rest, full: -set.rest, pad: id });
  return { gas: p(set.gas), brake: p(set.brake) };
}
const hatRest = (v: number) => Math.abs(v) > 1.05;

/**
 * The layout of a wheel nobody set up: axes0 is where its axes sat when it showed up (the browser shows a controller
 * after a button press, so the pedals are let go then).  Full lock is DEFAULT_LOCK_DEGREES of its rotation, or all
 * of it where that is unknown.  A known model's wheel and pedals come from its descriptor, placed as the browser
 * does: the placement that gives as many axes as the wheel shows, with its wheel off the ends and its gas and brake
 * at one, or every axis 0 (Chrome on macOS before the wheel's first report: the pedals rest at +1 then).  Any other
 * wheel's are guessed: the wheel is the first axis that is neither a hat switch let go nor at an end (X, axis 0,
 * where the browser has no hat switch before it); pedals are the axes resting at an end, the first the gas, the
 * brake Rz (axis 5 where axes are placed by usage) or else the last; without one at an end, combined pedals on the
 * axis after the wheel, gas up, brake down.  The buttons and the shifter's are the model's.
 */
export function guessMap(info: WheelInfo, axes0: readonly number[], nbuttons: number): WheelMap {
  const table = info.buttons ?? (info.layout === 'ps' ? PS_BUTTONS : info.layout === 'xbox' ? XBOX_BUTTONS : GENERIC_BUTTONS);
  const gears = shifterOf(info, nbuttons);
  const base = {
    centre: 0, lock: info.degrees > DEFAULT_LOCK_DEGREES ? DEFAULT_LOCK_DEGREES / info.degrees : 1,
    buttons: Array.from({ length: nbuttons }, (_, i) => table[i] ?? -1), ...(gears ? { gears } : {}),
  };
  const atEnd = (v: number | undefined) => typeof v === 'number' && !hatRest(v) && Math.abs(v) >= 0.9;
  const pedal = (i: number): Pedal => { const r = atEnd(axes0[i]) ? Math.sign(axes0[i]) : 1; return { axis: i, rest: r, full: -r }; };
  const m = info.axes, unread = axes0.every(v => v === 0);
  for (const p of m ? PLACEMENTS : []) {
    const a = placeAxes(m!, p);
    if (!a || a.length !== axes0.length) continue;
    const steer = a.at[m!.steer]!, gas = a.at[m!.gas]!, brake = a.at[m!.brake]!, hat = a.at.hat;
    if (!unread && (hatRest(axes0[steer]) || atEnd(axes0[steer]) || !atEnd(axes0[gas]) || !atEnd(axes0[brake]))) continue;
    return { ...base, steer, gas: pedal(gas), brake: pedal(brake),
      ...(p === 'kernel' && hat !== undefined ? { dpad: [hat, hat + 1] as [number, number] } : {}), placed: p };
  }
  const steer = Math.max(0, axes0.findIndex(v => !hatRest(v) && !atEnd(v)));
  const ends: number[] = [];
  axes0.forEach((v, i) => { if (i !== steer && atEnd(v)) ends.push(i); });
  let gas: Pedal | null = null, brake: Pedal | null = null;
  if (ends.length >= 2) {
    const b = ends.includes(5) && ends[0] !== 5 ? 5 : ends[ends.length - 1];
    gas = pedal(ends[0]); brake = pedal(b);
  } else if (ends.length === 1) gas = pedal(ends[0]);
  else {
    const c = axes0.findIndex((v, i) => i > steer && !hatRest(v));
    if (c >= 0) { gas = { axis: c, rest: 0, full: -1 }; brake = { axis: c, rest: 0, full: 1 }; }
  }
  return { ...base, steer, gas, brake };
}

/** a hat switch read as one axis (Chrome, Firefox on Windows and macOS) as PAD_D* bits: positions 0 (up) to 7
 *  (up-left) at 2/7 apart from -1; anything else (let go, or 0 before the first report) is none */
export function hatDirs(v: number): number {
  if (!(v >= -1.01 && v <= 1.01)) return 0;
  const pos = Math.round((v + 1) * 3.5);
  if (Math.abs(v - (pos / 3.5 - 1)) > 0.05) return 0;
  const U = 1 << PAD_DUP, D = 1 << PAD_DDOWN, L = 1 << PAD_DLEFT, R = 1 << PAD_DRIGHT;
  return [U, U | R, R, D | R, D, D | L, L, U | L][pos];
}

/** a hat switch read as two axes (Linux: x -1 left to 1 right, y -1 up to 1 down) as PAD_D* bits */
export function dpadDirs(x: number, y: number): number {
  return (x < -0.5 ? 1 << PAD_DLEFT : x > 0.5 ? 1 << PAD_DRIGHT : 0) | (y < -0.5 ? 1 << PAD_DUP : y > 0.5 ? 1 << PAD_DDOWN : 0);
}

const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;
/** axes belonging to controllers besides the wheel (pedals on their own USB) */
export type OtherAxes = (id: string) => readonly number[] | undefined;
/** a pedal's travel, 0 let go to 1 on the floor */
export function pedalValue(p: Pedal | null, axes: readonly number[], others?: OtherAxes): number {
  if (!p) return 0;
  let v = (p.pad !== undefined ? others?.(p.pad) : axes)?.[p.axis];
  // Some USB pedal sets expose zeroes until the first physical movement.
  if (p.pad !== undefined && v === 0) v = p.rest;
  if (typeof v !== 'number' || !isFinite(v) || p.full === p.rest) return 0;
  return clamp((v - p.rest) / (p.full - p.rest), 0, 1);
}

/** a wheel's state as the pad's; otherAxes reads pedals on their own USB. */
export function readWheel(axes: readonly number[], pressed: readonly boolean[], m: WheelMap, hat: number,
                          otherAxes?: OtherAxes): { buttons: number; axes: number[] } {
  let buttons = 0;
  for (let i = 0; i < pressed.length && i < m.buttons.length; i++) if (pressed[i] && m.buttons[i] >= 0) buttons |= 1 << m.buttons[i];
  if (hat >= 0 && hat !== m.steer) buttons |= hatDirs(axes[hat]);
  if (m.dpad) buttons |= dpadDirs(axes[m.dpad[0]], axes[m.dpad[1]]);
  const w = axes[m.steer];
  const lx = typeof w === 'number' && isFinite(w) && m.lock ? clamp((w - m.centre) / m.lock, -1, 1) : 0;
  return { buttons, axes: [lx, 0, 0, 0, pedalValue(m.brake, axes, otherAxes), pedalValue(m.gas, axes, otherAxes)] };
}

/** the axis carrying a hat switch read as one: one that reads outside -1..1 (let go), or -1 */
export function findHat(axes: readonly number[]): number {
  return axes.findIndex(hatRest);
}

// ---- the shifter ---------------------------------------------------------------------------------------------------
/** the model's shifter buttons (1st to 6th gear, reverse; -1 one the wheel does not show), or null: none known */
export function shifterOf(info: WheelInfo, nbuttons: number): number[] | null {
  const g = info.gears?.map(i => i < nbuttons ? i : -1);
  return g && g.some(i => i >= 0) ? g : null;
}

/** the shifter's position: 1 to 6 a gear, 7 reverse, 0 neutral */
export function shifterGear(pressed: readonly boolean[], gears: readonly number[]): number {
  for (let i = 0; i < gears.length; i++) if (gears[i] >= 0 && pressed[gears[i]]) return i + 1;
  return 0;
}

/** what the shifter does: push-up, a move into 1st, 3rd or 5th gear shifts up and into 2nd, 4th or 6th down, reverse
 *  holds the handbrake; pull-up, the same but up and down the other way round; handbrake, any gear holds it; off */
export type ShifterMode = 'push-up' | 'pull-up' | 'handbrake' | 'off';
export const SHIFTER_MODES: readonly ShifterMode[] = ['push-up', 'pull-up', 'handbrake', 'off'];
/** how long (ms) a move into a gear presses shift up or down: the game reads its controller once a frame, 30 times
 *  a second at the least, and a press it must see, and a let-go between two */
export const SHIFT_PRESS_MS = 100;

/**
 * The shifter as the pad's buttons, those the wheel's own shift with (runtime/dinput_pad.c g_prof_wheel, or what the
 * player bound to them in the game's Controls): the right paddle (RB) shifts up, the left (LB) down, Square (X) is
 * the handbrake.  The game's gearbox only shifts up and down, one gear a press, so a move of the lever into a gear
 * is a press of SHIFT_PRESS_MS, and the next shift a move back through neutral and in again: a lever left in a gear
 * holds no button, and the paddles shift as before.  A handbrake gear holds it while the lever is there, but not a
 * lever there when the wheel showed up (left in reverse, it would hold the car) until it has been in neutral.
 */
export class Shifter {
  private gear = -1;          // the lever's position as last read (-1: not yet)
  private armed = false;      // the lever has been in neutral since the wheel showed up
  private press = 0;
  private until = 0;

  /** the PAD_* bits for the lever in gear (shifterGear) at time now (ms) */
  buttons(gear: number, mode: ShifterMode, now: number): number {
    if (this.gear < 0) this.gear = gear;
    if (gear === 0) this.armed = true;
    if (gear !== this.gear) {
      this.gear = gear;
      if (gear >= 1 && gear <= 6 && (mode === 'push-up' || mode === 'pull-up')) {
        this.press = (gear % 2 === 1) === (mode === 'push-up') ? 1 << PAD_RB : 1 << PAD_LB;
        this.until = now + SHIFT_PRESS_MS;
      }
    }
    const brake = mode === 'handbrake' ? gear > 0 : mode !== 'off' && gear === 7;
    return (now < this.until ? this.press : 0) | (brake && this.armed ? 1 << PAD_X : 0);
  }
}

/** a short line for the log: what drives what */
export function describeMap(m: WheelMap, hat: number): string {
  const name = (id: string) => id.replace(/\s*\([^)]*\)$/, '').replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '');
  const p = (x: Pedal | null) => x ? `axis ${x.axis}${x.pad !== undefined ? ` of ${name(x.pad)}` : ''} (${x.rest.toFixed(2)} to ${x.full.toFixed(2)})` : 'none';
  const gears = m.gears ? m.gears.map(i => i >= 0 ? i : '-').join(' ') : '';
  return `wheel axis ${m.steer} (centre ${m.centre.toFixed(2)}, full lock ${m.lock >= 0 ? '+' : ''}${m.lock.toFixed(2)}), ` +
    `gas ${p(m.gas)}, brake ${p(m.brake)}, D-pad ${m.dpad ? `axes ${m.dpad.join(' and ')}` : hat >= 0 ? `axis ${hat}` : 'none seen'}, ` +
    `shifter ${gears ? `buttons ${gears}` : 'none known'}, ` +
    (m.learned ? 'set up by the player' : m.placed ? `the model's own (axes placed by ${m.placed})` : 'guessed');
}

// ---- the player's set-up, kept in this browser per model ------------------------------------------------------
const KEY = 'nfsu2.wheel.', SHIFTER_KEY = 'nfsu2.shifter.';
/** a model's part of the keys: its USB ids, or its name where the browser gives none */
const modelKey = (id: string) => { const u = usbIds(id); return u ? `${u.vendor}:${u.product}` : id.slice(0, 80); };
/** the key a wheel's set-up is kept under */
export function wheelKey(id: string): string {
  return KEY + modelKey(id);
}
/** Restore the player's steering and pedal set-up; external pedals are kept only while connected. */
export function withSetUp(guess: WheelMap, kept: WheelMap, has: (id: string) => boolean = () => true): WheelMap {
  const here = (p: Pedal | null) => p?.pad === undefined || has(p.pad);
  const pedals = here(kept.gas) && here(kept.brake)
    ? { gas: kept.gas, brake: kept.brake }
    : { gas: guess.gas, brake: guess.brake };
  return { ...guess, steer: kept.steer, centre: kept.centre, lock: kept.lock, ...pedals,
    dpad: kept.dpad ?? guess.dpad, placed: undefined, learned: true };
}
/** the picks of this page (storage may be off) */
const shifterPicks = new Map<string, ShifterMode>();
/** what the player picked for the model's shifter (default push-up) */
export function loadShifter(id: string): ShifterMode {
  let v: string | null | undefined = shifterPicks.get(modelKey(id));
  try { v ??= localStorage.getItem(SHIFTER_KEY + modelKey(id)); } catch { /* storage off */ }
  return SHIFTER_MODES.find(m => m === v) ?? 'push-up';
}
/** keep the player's pick for the model's shifter; gamepad.ts reads it again on the event */
export function saveShifter(id: string, mode: ShifterMode) {
  shifterPicks.set(modelKey(id), mode);
  try { localStorage.setItem(SHIFTER_KEY + modelKey(id), mode); } catch { /* storage off: for this page only */ }
  dispatchEvent(new Event(WHEEL_MAP_EVENT));
}
export function loadMap(id: string): WheelMap | null {
  try {
    const m = JSON.parse(localStorage.getItem(wheelKey(id)) ?? 'null') as WheelMap | null;
    const ok = (p: Pedal | null) => p === null || (Number.isInteger(p.axis) && p.axis >= 0 && isFinite(p.rest) && isFinite(p.full) && (p.pad === undefined || (typeof p.pad === 'string' && p.pad.length > 0 && p.pad.length <= 128)));
    return m && Number.isInteger(m.steer) && isFinite(m.centre) && isFinite(m.lock) && m.lock !== 0 && ok(m.gas) && ok(m.brake) &&
      Array.isArray(m.buttons) ? m : null;
  } catch { return null; }
}
/** keep the player's set-up (null: back to the guess); gamepad.ts reads it again on the event */
export function saveMap(id: string, m: WheelMap | null) {
  try { if (m) localStorage.setItem(wheelKey(id), JSON.stringify(m)); else localStorage.removeItem(wheelKey(id)); }
  catch { /* storage off: the guess stays */ }
  dispatchEvent(new Event(WHEEL_MAP_EVENT));
}
export const WHEEL_MAP_EVENT = 'nfsu2-wheel-map';

// ---- teaching the page the wheel's axes -------------------------------------------------------------------------
export type LearnStep = 'rest' | 'steer' | 'gas' | 'brake' | 'done';
/** how long (ms) a control has to be held still where it is for its step to take it */
const HOLD_MS = 700;

/**
 * The set-up's steps, fed the wheel's axes every frame (feed): let go of everything (rest: where every axis sits),
 * turn the wheel right to where full lock should be (steer: the axis that moved most, its centre and the lock, held
 * there HOLD_MS), press the gas pedal down (gas: the axis that moved most but the wheel's), the brake (brake: the
 * same, or the gas's axis the other way: combined pedals).  Each step takes a control once it has moved far enough
 * and held still; then map() is the wheel's set-up, with base's buttons.
 */
export class WheelLearn {
  step: LearnStep = 'rest';
  progress = 0;
  private rest: number[] = [];
  private last: number[] = [];
  private still = 0;
  private steer = -1;
  private centre = 0;
  private lock = 0;
  private gas: Pedal | null = null;
  private brake: Pedal | null = null;
  private lens: number[] = [];

  constructor(private base: WheelMap, private pads: readonly string[] = []) {}

  /** Feed wheel axes and, in the same order as pads, axes from separate USB pedal devices. */
  feed(own: readonly number[], now: number, more: readonly (readonly number[])[] = []): boolean {
    const axes = more.length ? [...own, ...more.flat()] : [...own];
    this.lens = [own.length, ...more.map(a => a.length)];
    const moved = this.last.length !== axes.length || axes.some((v, i) => Math.abs(v - this.last[i]) > 0.01);
    if (moved) this.still = now;
    this.last = axes.slice();
    const held = Math.min(1, (now - this.still) / HOLD_MS);
    const before = this.step;
    if (this.step !== 'rest' && more.length) this.restAgain(axes);
    switch (this.step) {
      case 'rest':
        this.progress = held;
        if (held >= 1) { this.rest = axes.slice(); this.step = 'steer'; }
        break;
      case 'steer': {
        const i = this.most(axes, [], 0.08, j => j < own.length);
        this.progress = i < 0 ? 0 : held;
        if (i >= 0 && held >= 1) { this.steer = i; this.centre = this.rest[i]; this.lock = axes[i] - this.rest[i]; this.step = 'gas'; }
        break;
      }
      case 'gas': {
        const i = this.most(axes, [this.steer], 0.3);
        this.progress = i < 0 ? 0 : held;
        if (i >= 0 && held >= 1) { this.gas = { axis: i, rest: this.rest[i], full: axes[i] }; this.step = 'brake'; }
        break;
      }
      case 'brake': {
        const gas = this.gas!;
        const i = this.most(axes, [this.steer], 0.3, j => j !== gas.axis || Math.sign(axes[j] - gas.rest) === -Math.sign(gas.full - gas.rest));
        this.progress = i < 0 ? 0 : held;
        if (i >= 0 && held >= 1) { this.brake = { axis: i, rest: this.rest[i], full: axes[i] }; this.step = 'done'; }
        break;
      }
    }
    if (this.step !== before) { this.progress = 0; this.still = now; }
    return this.step !== before;
  }

  private most(axes: readonly number[], skip: number[], min: number, ok: (i: number) => boolean = () => true): number {
    let best = -1, far = min;
    axes.forEach((v, i) => {
      const r = this.rest[i];
      if (skip.includes(i) || hatRest(v) || hatRest(r ?? 0) || typeof r !== 'number' || !ok(i)) return;
      const distance = Math.abs(v - r);
      if (distance >= far) { far = distance; best = i; }
    });
    return best;
  }

  map(): WheelMap | null {
    if (this.step !== 'done') return null;
    return { ...this.base, steer: this.steer, centre: this.centre, lock: this.lock, gas: this.where(this.gas),
      brake: this.where(this.brake), placed: undefined, learned: true };
  }

  private where(p: Pedal | null): Pedal | null {
    if (!p) return p;
    let i = p.axis - this.lens[0];
    if (i < 0) return p;
    for (let d = 0; d < this.pads.length; d++) {
      const n = this.lens[d + 1] ?? 0;
      if (i < n) {
        const rest = Math.abs(p.rest) < 0.9 && Math.abs(p.full) >= 0.9 ? -Math.sign(p.full) : p.rest;
        return { axis: i, rest, full: p.full, pad: this.pads[d] };
      }
      i -= n;
    }
    return null;
  }

  /** Independent pedals may report all-zero axes until first moved; capture their initial rest on that report. */
  private restAgain(axes: readonly number[]) {
    if (this.rest.length !== axes.length) return;
    for (let d = 1, at = this.lens[0]; d < this.lens.length; at += this.lens[d++]) {
      const n = this.lens[d];
      const unread = (j: number) => this.rest[j] === 0;
      if (n && Array.from({ length: n }, (_, j) => at + j).every(unread) && axes.slice(at, at + n).some(v => v !== 0)) {
        for (let j = at; j < at + n; j++) this.rest[j] = axes[j];
      }
    }
  }
}
