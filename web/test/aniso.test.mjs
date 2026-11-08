// D3D9 sampler keys: min, mag, mip, address U/V and MAXANISOTROPY (3-bit fields).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const js = (await esbuild.build({
  entryPoints: [path.join(ROOT, 'web/src/gpu/encoder.ts')], bundle: true, format: 'esm', write: false,
})).outputFiles[0].text;
const { anisotropicSamplerKey } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const key = ({ min = 2, mag = 2, mip = 2, level = 4 } = {}) =>
  min | (mag << 2) | (mip << 4) | (level << 12);

test('anisotropic filtering applies only to linear, mipmapped game textures with a MAXANISOTROPY request', () => {
  const k = key();
  assert.equal(anisotropicSamplerKey(k, false), (k & ~3) | 3);
  assert.equal(anisotropicSamplerKey(key({ mip: 0 }), false), key({ mip: 0 }));
  assert.equal(anisotropicSamplerKey(key({ min: 1 }), false), key({ min: 1 }));
  assert.equal(anisotropicSamplerKey(key({ mag: 1 }), false), key({ mag: 1 }));
  assert.equal(anisotropicSamplerKey(key({ level: 0 }), false), key({ level: 0 }));
  assert.equal(anisotropicSamplerKey(k, true), k);
});
