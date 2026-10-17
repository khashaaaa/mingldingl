import fs from 'node:fs';
import path from 'node:path';

const mockRegister = jest.fn(() => Promise.resolve());
jest.mock('expo-dev-menu', () => ({ registerDevMenuItems: mockRegister }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const src = path.join(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(src, p), 'utf8');

/** Loads devTools as a bundle built with this __DEV__ would see it. */
function devToolsWith(dev: boolean) {
  const g = globalThis as unknown as { __DEV__: boolean };
  const was = g.__DEV__;
  g.__DEV__ = dev;
  try {
    let mod!: typeof import('../devTools');
    jest.isolateModules(() => {
      mod = require('../devTools');
    });
    return { enabled: mod.devToolsEnabled(), registered: mod.registerDevTools() };
  } finally {
    g.__DEV__ = was;
  }
}

beforeEach(() => mockRegister.mockClear());

test('a release build (__DEV__ false) closes the dev group and never touches expo-dev-menu', () => {
  expect(devToolsWith(false)).toEqual({ enabled: false, registered: false });
  expect(mockRegister).not.toHaveBeenCalled();
});

test('a development build adds "MingldIngl tools" to the Expo dev menu', () => {
  expect(devToolsWith(true)).toEqual({ enabled: true, registered: true });
  expect(mockRegister).toHaveBeenCalledWith([expect.objectContaining({ name: 'MingldIngl tools' })]);
});

test('the dev group is only reachable through the devToolsEnabled guard', () => {
  expect(read('app/_layout.tsx')).toMatch(
    /<Stack\.Protected guard=\{devToolsEnabled\(\)\}>\s*<Stack\.Screen name="dev\/index"[^>]*\/>\s*<Stack\.Screen name="dev\/gallery" \/>\s*<\/Stack\.Protected>/,
  );
});

test('dev code is only required behind __DEV__, so Metro drops it from a release bundle', () => {
  for (const route of ['app/dev/index.tsx', 'app/dev/gallery.tsx'])
    expect(read(route)).toMatch(
      /^export default __DEV__ \? require\('@\/features\/dev\/\w+'\)\.default : \(\) => null;$/m,
    );

  // Nothing else imports the tools or expo-dev-menu directly.
  const offenders: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p);
      } else if (/\.tsx?$/.test(e.name)) {
        const rel = path.relative(src, p).replace(/\\/g, '/');
        if (rel.startsWith('features/dev/') || rel.startsWith('app/dev/')) continue;
        const s = fs.readFileSync(p, 'utf8');
        if (/from '@\/features\/dev|from '\.\.?\/.*dev\/|from 'expo-dev-menu'/.test(s)) offenders.push(rel);
      }
    }
  };
  walk(src);
  expect(offenders).toEqual([]);
});
