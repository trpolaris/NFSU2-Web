import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=path.join(REPO,'out/ci');fs.mkdirSync(OUT,{recursive:true});
test('hidden races bounded table mutation',()=>{
 const exe=path.join(OUT,'hiddenraces-unit');
 const b=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-Iruntime','tests/hiddenraces_unit.c','-o',exe],{cwd:REPO,encoding:'utf8'});
 assert.equal(b.status,0,b.stderr);
 const r=spawnSync(exe,[],{cwd:REPO,encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
 assert.match(r.stdout,/hidden races unit tests: all passed/);
});
