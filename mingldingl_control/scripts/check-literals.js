#!/usr/bin/env node
// Fails if a colour is typed into code instead of read from src/design/tokens.css (generated from
// Figma by the app's gen-tokens.js — the only source of colour). Generated files are exempt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const exempt = [/design[/\\]tokens\.css$/, /api[/\\]generated[/\\]/];
const pattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
const hits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|css)$/.test(e.name) && !exempt.some((r) => r.test(p))) {
      fs.readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (pattern.test(line)) hits.push(`${path.relative(root, p)}:${i + 1}: ${line.trim()}`);
        });
    }
  }
};
walk(root);
if (hits.length) {
  console.error(`Colour literals outside tokens.css:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('no colour literals');
