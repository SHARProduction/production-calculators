import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'payload');
const output = path.join(root, 'public');
const base = 'https://sharproduction.github.io/production-calculators';
const assets = JSON.parse(fs.readFileSync(path.join(root, 'repo.json'))).assets;

function transform(relative, content) {
  if (relative === 'robots.txt') return `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`;
  if (relative === 'sitemap.xml') return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', '/ru', ...assets.flatMap((asset) => [`/${asset.slug}/en`, `/${asset.slug}/ru`])].map((route) => `<url><loc>${base}${route}/</loc></url>`).join('')}</urlset>\n`;
  if (!relative.endsWith('/index.html')) return content;
  const match = relative.match(/^(.+)\/(en|ru)\/index\.html$/);
  if (!match) return content;
  const canonical = `${base}/${match[1]}/${match[2]}/`;
  return content.replace('name="robots" content="noindex,nofollow"', 'name="robots" content="index,follow"').replace('<title>', `<link rel="canonical" href="${canonical}"><title>`);
}

function expectedFiles() {
  const files = new Map();
  for (const entry of fs.readdirSync(source, { recursive: true, withFileTypes: true })) if (entry.isFile()) {
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(source, file).replaceAll('\\', '/');
    files.set(relative, Buffer.from(transform(relative, fs.readFileSync(file, 'utf8'))));
  }
  return files;
}

const expected = expectedFiles();
if (process.argv.includes('--check')) {
  let bad = false;
  for (const [relative, content] of expected) {
    const file = path.join(output, relative);
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) { console.error(`stale: ${relative}`); bad = true; }
  }
  if (bad) process.exit(1);
  console.log(`deterministic public build current: ${expected.size} files`);
} else {
  fs.rmSync(output, { recursive: true, force: true });
  for (const [relative, content] of expected) {
    const file = path.join(output, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  console.log(`built public/: ${expected.size} files`);
}
