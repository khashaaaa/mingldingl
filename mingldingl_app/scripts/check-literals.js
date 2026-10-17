#!/usr/bin/env node
// Fails if a colour is typed into code instead of read from src/design/tokens.ts (Figma is the
// only source of colour). Generated files and tests are exempt.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'src');
const exempt = [
  /design[/\\]tokens\.ts$/,
  /design[/\\]figma[/\\]/,
  /__tests__[/\\]/,
  /\.test\.tsx?$/,
  /api[/\\]generated[/\\]/,
];
const pattern = /(['"`])#[0-9a-fA-F]{3,8}\1|rgba?\(/g;
const hits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !exempt.some((r) => r.test(p))) {
      fs.readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (pattern.test(line)) hits.push(`${path.relative(root, p)}:${i + 1}: ${line.trim()}`);
          pattern.lastIndex = 0;
        });
    }
  }
};
walk(root);
if (hits.length) {
  console.error(`Colour literals outside tokens.ts:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('no colour literals');
