import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'repo.json')));
const base = 'https://sharproduction.github.io/production-calculators';

test('manifest keeps the paired MIT and CC-BY fixtures', () => {
  assert.equal(meta.assets.length, 2);
  assert.ok(meta.assets.every((asset) => asset.code_license === 'MIT' && asset.fixtures_license === 'CC-BY-4.0'));
});

test('Pages output is deterministic and exact for both languages', () => {
  const build = spawnSync(process.execPath, ['scripts/build.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  for (const asset of meta.assets) for (const language of ['en', 'ru']) {
    const file = path.join(root, 'public', asset.slug, language, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    const url = `${base}/${asset.slug}/${language}/`;
    assert.match(html, /name="robots" content="index,follow"/);
    assert.match(html, new RegExp(`rel="canonical" href="${url}"`));
    assert.match(html, /SHAR Production/);
  }
});
