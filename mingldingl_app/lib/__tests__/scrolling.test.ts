import fs from 'fs';
import path from 'path';

const APP_ROOT = path.join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return fs.readdirSync(path.join(APP_ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(rel);
    return e.name.endsWith('.tsx') ? [rel] : [];
  });
}

const SCROLLERS = /<(Animated\.)?(ScrollView|FlatList|SectionList)\b/;

/**
 * A touchable wrapped round a scroll view claims most drags before the scroll view can: Edit Your
 * Character only scrolled when a swipe began on the bio field, and the city picker and the chat's
 * activities sheet had the same shape. The dismiss tap goes *behind* a sheet, and a scrolling
 * screen dismisses the keyboard through the ScrollView's own props.
 */
describe('scroll views are never inside a touchable', () => {
  const files = [...sources('app'), ...sources('components')];

  it('keeps DismissKeyboardView off every screen that scrolls', () => {
    const offenders = files.filter((f) => {
      const text = fs.readFileSync(path.join(APP_ROOT, f), 'utf8');
      return text.includes('<DismissKeyboardView>') && SCROLLERS.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('never opens a scroll view while a Tap or Pressable is still open around it', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = fs.readFileSync(path.join(APP_ROOT, f), 'utf8');
      let open = 0;
      for (const m of text.matchAll(/<(\/?)(Tap|Pressable|TouchableWithoutFeedback|Animated\.ScrollView|ScrollView|FlatList|SectionList)\b(?:=>|[^>])*?(\/?)>/gs)) {
        const [, close, tag, self] = m;
        const touchable = tag === 'Tap' || tag === 'Pressable' || tag === 'TouchableWithoutFeedback';
        if (touchable && !self) open += close ? -1 : 1;
        if (!touchable && !close && open > 0) offenders.push(`${f}:${text.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
