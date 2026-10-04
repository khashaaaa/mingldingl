import fs from 'fs';
import path from 'path';
import { incomingPath, routeIncomingLink, setIncomingLinkHandler, TAB_ROUTES } from '../incomingLinks';

describe('incomingPath', () => {
  it('turns an app link into a route, query and all', () => {
    expect(incomingPath('mingldingl://settings', 'mingldingl')).toBe('/settings');
    expect(incomingPath('mingldingl:///chat/m1?x=1', 'mingldingl')).toBe('/chat/m1?x=1');
  });

  it('puts a tab link inside the tab group, so it switches tab instead of searching the stack', () => {
    expect(incomingPath('mingldingl://profile', 'mingldingl')).toBe('/(tabs)/profile');
    expect(incomingPath('mingldingl://matches?x=1', 'mingldingl')).toBe('/(tabs)/matches?x=1');
  });

  it('knows every tab screen there is', () => {
    const dir = path.join(__dirname, '../../app/(tabs)');
    const tabs = fs.readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.startsWith('_')).map((f) => f.replace(/\.tsx$/, ''));
    expect([...TAB_ROUTES].sort()).toEqual(tabs.sort());
  });

  it('leaves the dev client and foreign links alone', () => {
    expect(incomingPath('mingldingl://expo-development-client/?url=http%3A%2F%2Fx', 'mingldingl')).toBeNull();
    expect(incomingPath('https://example.com/settings', 'mingldingl')).toBeNull();
  });
});

describe('routeIncomingLink', () => {
  afterEach(() => setIncomingLinkHandler(null));

  it('sends a warm link through the handler and swallows it, so the router does not push it again', () => {
    const go = jest.fn();
    setIncomingLinkHandler(go);
    expect(routeIncomingLink('mingldingl://satchel', false, 'mingldingl')).toBeNull();
    expect(go).toHaveBeenCalledWith('/satchel');
  });

  it('leaves a cold-start link to the router — nothing is open to return to', () => {
    const go = jest.fn();
    setIncomingLinkHandler(go);
    expect(routeIncomingLink('mingldingl://satchel', true, 'mingldingl')).toBe('mingldingl://satchel');
    expect(go).not.toHaveBeenCalled();
  });

  it('passes everything through before the app has mounted a handler', () => {
    expect(routeIncomingLink('mingldingl://satchel', false, 'mingldingl')).toBe('mingldingl://satchel');
  });

  it('never swallows the dev client link that loads the bundle', () => {
    const go = jest.fn();
    setIncomingLinkHandler(go);
    const dev = 'mingldingl://expo-development-client/?url=http%3A%2F%2F192.168.1.32%3A8081';
    expect(routeIncomingLink(dev, false, 'mingldingl')).toBe(dev);
    expect(go).not.toHaveBeenCalled();
  });
});
