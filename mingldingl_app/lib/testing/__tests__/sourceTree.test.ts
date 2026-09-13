import { blankComments } from '../sourceTree';

/**
 * `blankComments` is what stands between a key mentioned only in a comment and the coverage
 * scan believing the app still reads it — `i18nCoverage.test.ts` runs every file through it
 * before scanning for `i18n.t(` calls. These are the shapes that scan actually depends on.
 */
describe('blankComments', () => {
  it('blanks a key that appears only in a line comment', () => {
    const src = "// i18n.t('ghost_key')\nconst x = 1;";
    expect(blankComments(src)).not.toMatch(/ghost_key/);
  });

  it('blanks a key that appears only in a block comment', () => {
    const src = "/* i18n.t('ghost_key') */\nconst x = 1;";
    expect(blankComments(src)).not.toMatch(/ghost_key/);
  });

  it('preserves newlines, line count and character length', () => {
    const src = "// one\nconst a = 1;\n/* two\nthree */\nconst b = 2;\n";
    const out = blankComments(src);
    expect(out.split('\n').length).toBe(src.split('\n').length);
    // Character-for-character fidelity, the way the original regex version had it: a block
    // comment's opening `/*` must be spaced like everything else inside it, not dropped.
    expect(out.length).toBe(src.length);
  });

  it('does not treat // inside a string literal as a comment start', () => {
    // A URL on the same line as a real i18n.t() call: a naive `\/\/.*$` regex sees the `//` in
    // `https://` and blanks everything after it on the line — including the real call — which
    // would make `real_key` look orphaned even though this line names it.
    const src = "const u = 'https://x'; i18n.t('real_key')";
    expect(blankComments(src)).toMatch(/real_key/);
  });

  it('still blanks a genuine line comment that follows code containing a string', () => {
    const src = "const u = 'x'; // i18n.t('ghost_key')\ni18n.t('real_key')";
    const out = blankComments(src);
    expect(out).not.toMatch(/ghost_key/);
    expect(out).toMatch(/real_key/);
  });

  it('does not treat an escaped / in a regex literal as starting a comment', () => {
    // The regex literal escapes its own delimiter (`\/`); a scanner with no notion of that
    // escape reaches the closing `\/\/ ` and reads the last two slashes as `//`, blanking the
    // real i18n.t() call that follows on the same line — the same failure class as the string
    // case above, just via a regex literal instead of a string.
    const src = "const re = /https?:\\/\\//; i18n.t('real_key')";
    expect(blankComments(src)).toMatch(/real_key/);
  });
});
