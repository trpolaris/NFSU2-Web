#!/usr/bin/env python3
"""The texture packs: TEXPACKS/<name>.pak in the game folder, which the
browser's runtime (runtime/web/texrep_web.c) reads when a player picks one in
Settings.  One so far: LunicAura106's "Upscaled HUD" (UHUD,
nfsmods.xyz/mod/4319), the menus, HUD, fonts, icons and logos redrawn at four
times their size.

    tools/texpacks.py <game folder> --uhud <mod folder>

<mod folder> is the mod's archive (NFSU2UHUD11192022a.7z) extracted: the
folder with install.end and assets/ in it (`7z x`; Windows' tar and bsdtar read
it too).

The mod's installer (an endscript for the Binary tool) writes its textures into
the game's own bundles, and its plugin (NFSU2HDContentSupport.asi) then gives
the game the old sizes back where the game measures a texture: the fonts' glyph
positions, the mouse cursor and three menu textures.  The port does neither.
The game keeps reading its own files and keeps seeing every texture at its own
size; only the GPU gets the mod's texture in its place.  So the fonts' glyph
tables, the layout and the cursor stay right without the plugin.

The pack keys a texture by what the game uploads for it: CRC-32 and Adler-32 of
its level 0, its size and its format.  A texture a language pack redrew (the
Polish, Turkish, Russian, Chinese, Japanese and Thai fonts, Japanese's menu
textures)
has other bytes, so the game keeps showing the language pack's own.  What the
installer leaves out by default stays out: the part-category icons for the
Unlimiter mod (its "No") and the plugin.

Pack layout (little-endian):
  header   'NTXP', version 1, entry count, 0
  entries  40 bytes each, sorted by (crc, adler):
           crc, adler, ow, oh (u16), ofmt   the game's texture: CRC-32 and Adler-32 of level 0
                                            as uploaded, its size, its D3DFORMAT
           w, h (u16), fmt, levels          the replacement
           off, size                        its levels, level 0 first, each pitch x rows as
                                            the runtime uploads it (DXT: rows of 4x4 blocks)
           name                             file offset of its name (for the log)
  the names, then the levels, in the order of the game files and textures they
  replace (a load reads them together)
"""
import argparse, os, struct, sys, zlib

ARGB, P8 = 21, 41                                   # D3DFORMATs
FOURCC = {b'DXT1': 0x31545844, b'DXT3': 0x33545844, b'DXT5': 0x35545844}
BLOCK_BYTES = {0x31545844: 8, 0x33545844: 16, 0x35545844: 16}
FMT_NAME = {ARGB: 'A8R8G8B8', 0x31545844: 'DXT1', 0x33545844: 'DXT3', 0x35545844: 'DXT5'}

# UHUD's folders (under assets/) and the game files whose textures they replace, as its install.end binds them.
# The per-HUD files hold compressed copies of HUD_CustomTextures_ALL.bin's textures, some in EA's HUFF, which this
# does not read: those are keyed from _ALL's copy (the JDLZ ones are the same bytes, all 71).
UHUD = [
    ('FRONTB/FRONTENDTEXTURES', ['FRONTEND/FrontB.lzc']),
    ('GLOBALA', ['GLOBAL/GLOBALA.BUN']),
    ('GLOBALB/GLOBALTEXTURES', ['GLOBAL/GlobalB.lzc']),
    ('GLOBALB/GLOBALTEXTURESPC', ['GLOBAL/GlobalB.lzc']),
    ('LANGUAGETEXTURES', ['LANGUAGES/LanguageTextures.bin']),
    ('INGAMECOMMON/INGAMETEXTURES', ['GLOBAL/InGameCommon.lzc']),
    ('INGAMECOMMON/HUDTEXTURESGLOBAL', ['GLOBAL/InGameCommon.lzc']),
    ('INGAMERACE', ['GLOBAL/InGameRace.bun']),
    ('INGAMEDRIFT', ['GLOBAL/InGameDrift.bun']),
    ('INGAMEDRAG', ['GLOBAL/InGameDrag.bun']),
    ('INGAMEFREEROAM', ['GLOBAL/InGameFreeRoam.bun']),
    ('HUD_CUSTOMTEXTURES_ALL', ['GLOBAL/HUD_CustomTextures_ALL.bin']),
] + [(f'HUD_CUSTOMTEXTURES_{i:02d}', [f'GLOBAL/HUD_CustomTextures_{i:02d}.bin', 'GLOBAL/HUD_CustomTextures_ALL.bin'])
     for i in range(11)]


def find(root, rel):
    """rel under root, each part matched case-insensitively; None if missing"""
    cur = root
    for part in rel.split('/'):
        if not os.path.isdir(cur): return None
        hit = next((n for n in os.listdir(cur) if n.lower() == part.lower()), None)
        if hit is None: return None
        cur = os.path.join(cur, hit)
    return cur


def jdlz(b):
    """EA's JDLZ: the .lzc bundles and compressed textures"""
    n, = struct.unpack_from('<I', b, 8)
    out = bytearray(n)
    i, o, f1, f2 = 16, 0, 1, 1
    while i < len(b) and o < n:
        if f1 == 1: f1 = b[i] | 0x100; i += 1
        if f2 == 1: f2 = b[i] | 0x100; i += 1
        if f1 & 1:
            if f2 & 1: ln, t = (b[i + 1] | (b[i] & 0xF0) << 4) + 3, (b[i] & 0x0F) + 1
            else: t, ln = (b[i + 1] | (b[i] & 0xE0) << 3) + 17, (b[i] & 0x1F) + 3
            i += 2
            for k in range(ln): out[o + k] = out[o + k - t]
            o += ln; f2 >>= 1
        else:
            out[o] = b[i]; o += 1; i += 1
        f1 >>= 1
    if o != n: sys.exit(f'JDLZ: {o} of {n} bytes')
    return bytes(out)


class _Bits:
    """big-endian bit reader for HUFF"""
    def __init__(self, data):
        self.data, self.at, self.value, self.count = data, 0, 0, 0

    def peek(self, size):
        while self.count < size and self.at < len(self.data):
            self.value = (self.value << 8) | self.data[self.at]; self.count += 8; self.at += 1
        return self.value << (size - self.count) if self.count < size else self.value >> (self.count - size)

    def get(self, size):
        r = self.peek(size)
        if self.count < size: raise ValueError('HUFF: truncated')
        self.count -= size; self.value &= (1 << self.count) - 1
        return r

    def number(self):
        width = 2
        while not self.get(1):
            width += 1
            if width > 30: raise ValueError('HUFF: unbounded number')
        return self.get(width) + (1 << width) - 4


def huff(data, max_output_bytes=1 << 20):
    """EA's HUFF ('HUFF' 01 10: canonical Huffman with a clue symbol for runs and literals, optional delta passes;
    most of CARS/<car>/VINYLS.BIN's textures).  Every size and table is bounded; a bad block raises ValueError."""
    if len(data) < 16 or data[:6] != b'HUFF\x01\x10': raise ValueError('HUFF: unknown header')
    expected, packed = struct.unpack_from('<II', data, 8)
    if not 0 < expected <= max_output_bytes or not 0 < packed <= len(data) - 16: raise ValueError('HUFF: sizes')
    bits = _Bits(data[16:16 + packed])
    kind = bits.get(16)
    if kind & 0x100: bits.get(32 if kind & 0x8000 else 24)
    kind &= ~0x100
    if kind not in (0x30FB, 0x32FB, 0x34FB, 0xB0FB, 0xB2FB, 0xB4FB): raise ValueError(f'HUFF: coding {kind:04x}')
    if bits.get(32 if kind & 0x8000 else 24) != expected: raise ValueError('HUFF: inner size')
    clue = bits.get(8)
    entries, base, total = [], 0, 0
    for width in range(1, 17):
        base <<= 1
        n = bits.number()
        if total + n > 256 or base + n > 1 << width: raise ValueError('HUFF: code table')
        entries.append((width, base, n)); base += n; total += n
        if base == 1 << width: break
    else:
        raise ValueError('HUFF: incomplete code table')
    used, symbols, cur = set(), [], 255
    for _ in range(total):
        skip = bits.number() + 1
        if skip > 256 - len(used): raise ValueError('HUFF: symbol order')
        while skip:
            cur = (cur + 1) & 255
            if cur not in used: skip -= 1
        used.add(cur); symbols.append(cur)
    quick, full, k = [None] * 256, {}, 0
    for width, start, n in entries:
        for code in range(start, start + n):
            sym = symbols[k]; k += 1; full[width, code] = sym
            if width <= 8:
                for i in range(code << (8 - width), (code + 1) << (8 - width)): quick[i] = width, sym
    out = bytearray()
    while True:
        e = quick[bits.peek(8)]
        if e is None:
            for width in range(9, 17):
                sym = full.get((width, bits.peek(width)))
                if sym is not None: bits.get(width); break
            else:
                raise ValueError('HUFF: unknown code')
        else:
            width, sym = e; bits.get(width)
        if sym != clue:
            out.append(sym)
        else:
            run = bits.number()
            if run:
                if not out or len(out) + run > expected: raise ValueError('HUFF: run')
                out.extend(bytes([out[-1]]) * run)
            elif bits.get(1):
                break
            else:
                out.append(bits.get(8))
        if len(out) > expected: raise ValueError('HUFF: overrun')
    if len(out) != expected: raise ValueError('HUFF: short')
    if kind in (0x32FB, 0xB2FB, 0x34FB, 0xB4FB):
        v = v2 = 0
        for i, d in enumerate(out):
            v = (v + d) & 255; v2 = (v2 + v) & 255
            out[i] = v2 if kind in (0x34FB, 0xB4FB) else v
    return bytes(out)


def chunks(d, off, end):
    while off + 8 <= end:
        cid, sz = struct.unpack_from('<II', d, off)
        if sz > end - off - 8: return
        yield cid, off + 8, off + 8 + sz
        off += 8 + sz


def tpks(d, off, end, depth=0):
    for cid, b, e in chunks(d, off, end):
        if cid == 0xB3300000: yield b, e
        elif cid & 0x80000000 and depth < 6: yield from tpks(d, b, e, depth + 1)


def level_size(w, h, fmt):
    if fmt in BLOCK_BYTES: return max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * BLOCK_BYTES[fmt]
    return w * h * 4


def texture(ti, pf, buf, base):
    """(name hash, w, h, D3DFORMAT, level 0 as the game uploads it); level 0 None if this reads no such format"""
    nh, = struct.unpack_from('<I', ti, 0x24)
    img_off, pal_off, img_size, pal_size, base_size = struct.unpack_from('<5I', ti, 0x30)
    w, h = struct.unpack_from('<HH', ti, 0x44)
    four = pf[0x14:0x18] if len(pf) >= 0x18 else b''
    code = struct.unpack('<I', four)[0] if len(four) == 4 else 0
    p = base + img_off
    if four in FOURCC:
        fmt = FOURCC[four]; lv0 = buf[p:p + level_size(w, h, fmt)]
    elif code == ARGB:
        fmt = ARGB; lv0 = buf[p:p + w * h * 4]
    elif code == P8 and pal_size >= 1024:
        # the game expands it with its palette (BGRA, as A8R8G8B8 is in memory) before the upload
        fmt, ix, pal = ARGB, buf[p:p + w * h], buf[base + pal_off:base + pal_off + 1024]
        out = bytearray(w * h * 4)
        for c in range(4): out[c::4] = ix.translate(bytes(pal[c::4]))
        lv0 = bytes(out)
    else:
        return nh, w, h, code, None
    return nh, w, h, fmt, (lv0 if len(lv0) == level_size(w, h, fmt) else None)


def textures(d):
    """the textures of a bundle's TPKs, in their order: (name hash, w, h, D3DFORMAT, level 0 or None)"""
    for b, e in tpks(d, 0, len(d)):
        info = data = None
        for cid, cb, ce in chunks(d, b, e):
            if cid == 0xB3310000: info = (cb, ce)
            elif cid == 0xB3320000: data = (cb, ce)
        if not info or not data: continue
        part = {cid: (cb, ce) for cid, cb, ce in chunks(d, *info)}
        pix = next(((cb + 0x7F) & ~0x7F for cid, cb, ce in chunks(d, *data) if cid == 0x33320002), None)
        if 0x33310004 in part and pix is not None:
            (tb, te), pl = part[0x33310004], part.get(0x33310005, (0, 0))
            for i in range((te - tb) // 0x7C):
                pf = d[pl[0] + i * 0x20:pl[0] + (i + 1) * 0x20] if pl[0] + (i + 1) * 0x20 <= pl[1] else b''
                yield texture(d[tb + i * 0x7C:tb + (i + 1) * 0x7C], pf, d, pix)
        elif 0x33310003 in part:
            # compressed textures: each one's data, then its TextureInfo (0x7C) and platform info (0x20)
            cb, ce = part[0x33310003]
            for i in range((ce - cb) // 24):
                nh, off, size = struct.unpack_from('<3I', d, cb + i * 24)
                blob = d[off:off + size]
                if blob[:4] != b'JDLZ':
                    yield nh, 0, 0, 0, None; continue
                out = jdlz(blob)
                ti = out[len(out) - 0x9C:len(out) - 0x20]
                yield texture(ti, out[len(out) - 0x20:], out, -struct.unpack_from('<I', ti, 0x30)[0])


def bstring_hash(s):
    """the game's name hash (bStringHash)"""
    h = 0xFFFFFFFF
    for c in s.encode('latin1'): h = (h * 33 + c) & 0xFFFFFFFF
    return h


def dds(path):
    """(w, h, D3DFORMAT, levels, their bytes) of a DDS file; None if this cannot use it"""
    with open(path, 'rb') as f: b = f.read()
    if b[:4] != b'DDS ' or len(b) < 128: return None
    h, w = struct.unpack_from('<II', b, 12)
    mips = max(1, struct.unpack_from('<I', b, 28)[0])
    flags, four, bits = struct.unpack_from('<I4sI', b, 80)
    masks = struct.unpack_from('<4I', b, 92)
    if flags & 4: fmt = FOURCC.get(four)
    elif bits == 32 and masks == (0xFF0000, 0xFF00, 0xFF, 0xFF000000): fmt = ARGB
    else: fmt = None
    if not fmt or not w or not h: return None
    n, lv = 0, 0
    while lv < mips and 128 + n + level_size(max(1, w >> lv), max(1, h >> lv), fmt) <= len(b):
        n += level_size(max(1, w >> lv), max(1, h >> lv), fmt); lv += 1
    return (w, h, fmt, lv, b[128:128 + n]) if lv else None


def find_mod(mod):
    """the folder with UHUD's texture folders: <mod>/assets, or <mod> itself"""
    for d in (os.path.join(mod, 'assets'), mod):
        if os.path.isdir(os.path.join(d, 'FRONTB', 'FRONTENDTEXTURES')): return d
    sys.exit(f'{mod}: no assets/FRONTB/FRONTENDTEXTURES: not the UHUD mod\'s folder')


def uhud(game, mod):
    assets = find_mod(mod)
    bundles = {}                    # game file -> {name hash: (index, w, h, fmt, level 0)}
    ents = {}                       # (crc, adler) -> entry
    data, data_at = bytearray(), {}
    seen = {'replaced': 0, 'shared': 0, 'not in the game': [], 'unreadable': [], 'other shape': [], 'conflict': []}
    for folder, files in UHUD:
        src = os.path.join(assets, *folder.split('/'))
        if not os.path.isdir(src): continue
        texs = []
        for rel in files:
            if rel not in bundles:
                p = find(game, rel)
                if not p: sys.exit(f'{game}: no {rel}')
                with open(p, 'rb') as f: d = f.read()
                bundles[rel] = {t[0]: (i,) + t[1:] for i, t in enumerate(textures(jdlz(d) if d[:4] == b'JDLZ' else d))}
            texs.append(bundles[rel])
        todo = []
        for fn in os.listdir(src):
            if not fn.lower().endswith('.dds'): continue
            name = fn[:-4]
            nh = bstring_hash(name.upper())
            t = next((x[nh] for x in texs if nh in x and x[nh][4] is not None), None)
            if t is None:
                seen['not in the game'].append(f'{folder}/{name}'); continue
            todo.append((t[0], name, t))
        for _, name, (i, ow, oh, ofmt, lv0) in sorted(todo):
            r = dds(os.path.join(src, name + '.dds'))
            label = f'{folder}/{name}'
            if not r:
                seen['unreadable'].append(label); continue
            w, h, fmt, levels, lv = r
            if w * oh != h * ow or w < ow:
                seen['other shape'].append(f'{label} ({ow}x{oh} -> {w}x{h})'); continue
            key = (zlib.crc32(lv0), zlib.adler32(lv0))
            if key in ents:
                e = ents[key]
                if bytes(data[e['off']:e['off'] + e['size']]) == lv and (e['w'], e['h'], e['fmt']) == (w, h, fmt):
                    seen['shared'] += 1
                else:
                    seen['conflict'].append(f'{label} (kept {e["name"]})')
                continue
            if lv not in data_at:
                data_at[lv] = len(data); data += lv
                data += bytes(-len(data) % 16)
            ents[key] = dict(key=key, ow=ow, oh=oh, ofmt=ofmt, w=w, h=h, fmt=fmt, levels=levels,
                             off=data_at[lv], size=len(lv), name=label)
            seen['replaced'] += 1
    write(os.path.join(game, 'TEXPACKS', 'uhud.pak'), ents, data)
    print(f'uhud: {len(ents)} textures ({seen["shared"]} more share one), '
          f'{len(data) / 1048576:.1f} MB -> {os.path.join(game, "TEXPACKS", "uhud.pak")}')
    for k in ('not in the game', 'unreadable', 'other shape', 'conflict'):
        if seen[k]: print(f'  {k}: {len(seen[k])}: ' + ', '.join(seen[k][:6]) + (' ...' if len(seen[k]) > 6 else ''))


def write(path, ents, data):
    order = sorted(ents.values(), key=lambda e: e['key'])
    names = bytearray()
    at = 16 + 40 * len(order)
    for e in order:
        e['name_at'] = at + len(names); names += e['name'].encode('latin1') + b'\0'
    base = (at + len(names) + 4095) & ~4095
    out = bytearray(struct.pack('<4sIII', b'NTXP', 1, len(order), 0))
    for e in order:
        out += struct.pack('<IIHHIHHIIIII', *e['key'], e['ow'], e['oh'], e['ofmt'], e['w'], e['h'], e['fmt'], e['levels'],
                           base + e['off'], e['size'], e['name_at'])
    out += names
    out += bytes(base - len(out))
    # as runtime/web/texrep_web.c reads it (tools/packcheck.py): never written otherwise
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import packcheck
    bad = packcheck.check(None, {f'TEXPACKS/{os.path.basename(path)}': bytes(out) + bytes(data)})
    if bad: sys.exit(f'{path}: not written, tools/packcheck.py says: ' + '; '.join(why for _, why in bad[:20]))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.part'
    with open(tmp, 'wb') as f:
        f.write(out); f.write(data)
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser(usage='tools/texpacks.py <game folder> --uhud <mod folder>')
    ap.add_argument('game')
    ap.add_argument('--uhud', metavar='MOD', help='the Upscaled HUD mod (nfsmods.xyz/mod/4319), extracted')
    a = ap.parse_args()
    if not a.uhud: sys.exit(__doc__)
    if not find(a.game, 'SPEED2.EXE'): sys.exit(f'{a.game}: no SPEED2.EXE, not the game folder')
    uhud(a.game, a.uhud)


if __name__ == '__main__':
    main()
