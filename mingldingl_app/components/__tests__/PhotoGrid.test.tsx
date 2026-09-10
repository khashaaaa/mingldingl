import { newUris, applyUploaded } from '../PhotoGrid';

/**
 * Picking the same library asset twice hands back the same URI. Keeping both put a duplicate key
 * in the grid, uploaded the file twice — leaving one copy orphaned on a public, unauthenticated
 * path forever — mapped both entries onto the one public URL, and made a single delete remove
 * both tiles at once.
 */
describe('newUris', () => {
  it('keeps only the first of a repeated pick', () => {
    expect(newUris([], ['file:///a.jpg', 'file:///a.jpg', 'file:///b.jpg']))
      .toEqual(['file:///a.jpg', 'file:///b.jpg']);
  });

  it('drops a pick that is already on the profile', () => {
    expect(newUris(['https://cdn/a.jpg'], ['https://cdn/a.jpg', 'file:///b.jpg']))
      .toEqual(['file:///b.jpg']);
  });

  it('passes distinct picks through untouched, in order', () => {
    expect(newUris(['https://cdn/x.jpg'], ['file:///a.jpg', 'file:///b.jpg']))
      .toEqual(['file:///a.jpg', 'file:///b.jpg']);
  });

  it('returns nothing when every pick is already known', () => {
    expect(newUris(['file:///a.jpg'], ['file:///a.jpg'])).toEqual([]);
  });
});

describe('applyUploaded', () => {
  it('swaps each local URI for the URL it uploaded to', () => {
    expect(applyUploaded(
      ['https://cdn/keep.jpg', 'file:///a.jpg'],
      new Map([['file:///a.jpg', 'https://cdn/a.jpg']]),
    )).toEqual(['https://cdn/keep.jpg', 'https://cdn/a.jpg']);
  });

  it('leaves a still-uploading URI in place', () => {
    expect(applyUploaded(['file:///pending.jpg'], new Map())).toEqual(['file:///pending.jpg']);
  });

  /** The same photo picked in two separate batches lands on one URL; the grid keys on it. */
  it('collapses two entries that resolved to the same URL', () => {
    expect(applyUploaded(
      ['https://cdn/a.jpg', 'file:///a.jpg'],
      new Map([['file:///a.jpg', 'https://cdn/a.jpg']]),
    )).toEqual(['https://cdn/a.jpg']);
  });
});
