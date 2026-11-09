// The game's 4x MSAA: WebGPU samples stay in a texture twin and a shader resolves them into the target.
// This guards the manual resolve path against accidentally returning to resolveTarget, which failed on some GPUs.
//   node --test web/test/gpu-msaa-resolve.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const encoder = fs.readFileSync(path.join(ROOT, 'web/src/gpu/encoder.ts'), 'utf8');
const wgsl = fs.readFileSync(path.join(ROOT, 'web/src/gpu/wgsl.ts'), 'utf8');

test('4x MSAA twins are sampleable and resolved by a separate shader pass', () => {
  assert.match(encoder, /import \{ COPY, FF_FS, MS_RESOLVE, TONE, TVERT_VS \} from '\.\/wgsl';/);
  assert.match(encoder, /private msRes: \{/);
  assert.match(encoder, /GPUTextureUsage\.RENDER_ATTACHMENT \| GPUTextureUsage\.TEXTURE_BINDING/);
  assert.match(encoder, /sampleType: 'unfilterable-float', multisampled: true/);
  assert.match(encoder, /private msResolve\(enc: GPUCommandEncoder, twin: MsTwin, dst: GPUTextureView\)/);
  assert.match(encoder, /this\.module\('ms-resolve', MS_RESOLVE\)/);
  assert.match(encoder, /this\.msResolve\(enc, msOut\.twin, msOut\.dst\)/);
  assert.match(encoder, /msOut = \{ twin, dst: view \}/);
  assert.doesNotMatch(encoder, /resolveTarget\s*:/, 'the hardware resolveTarget path remains disabled');
  assert.match(wgsl, /export const MS_RESOLVE = \/\* wgsl \*\//);
  for (const sample of [0, 1, 2, 3]) {
    assert.match(wgsl, new RegExp('textureLoad\\(src, c, ' + sample + '\\)'));
  }
  assert.match(wgsl, /\* 0\.25/);
});
