import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..', '..', 'app');
const files: string[] = [];
const walk = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(path.relative(appDir, p).replace(/\\/g, '/'));
  }
};
walk(appDir);

const GROUPS = ['(out)', '(closed)', '(onboarding)', '(world)', 'dev'] as const;
const ROOT_FILES = ['_layout.tsx', '+native-intent.tsx', '+not-found.tsx'];

test('every route belongs to exactly one gate group', () => {
  const stray = files.filter((f) => !ROOT_FILES.includes(f) && !GROUPS.some((g) => f.startsWith(`${g}/`)));
  expect(stray).toEqual([]);
});

test('every group the gate can choose has an entry route', () => {
  for (const entry of [
    '(out)/index.tsx',
    '(closed)/index.tsx',
    '(onboarding)/index.tsx',
    '(world)/(tabs)/character.tsx',
    'dev/index.tsx',
  ])
    expect(files).toContain(entry);
});

test('the world has the five tabs and the edit screen', () => {
  for (const tab of ['seek', 'quests', 'missions', 'square', 'character'])
    expect(files).toContain(`(world)/(tabs)/${tab}.tsx`);
  expect(files).toContain('(world)/character-edit.tsx');
});

test('route files are thin: no screen logic in src/app', () => {
  for (const f of files.filter((x) => !x.endsWith('_layout.tsx') && !x.startsWith('+'))) {
    const src = fs.readFileSync(path.join(appDir, f), 'utf8');
    expect({ f, lines: src.split('\n').length < 15 }).toEqual({ f, lines: true });
  }
});
