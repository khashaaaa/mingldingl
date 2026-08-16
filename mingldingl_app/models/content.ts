import type { components } from '../lib/api/api.generated';

// Server returns both languages together (see engine's ContentDto.cs). Kept
// bilingual here rather than picking one at parse time: this object is
// cached by react-query, and locale picked inside the parse step gets baked
// into that cache — switching languages then re-renders the screen (via its
// useLocaleStore subscription) without the cached data ever being
// re-derived, so the page silently stays in whichever language it was first
// fetched in. selectContentPageLocale() re-picks on every render instead.
export interface ContentPage {
  slug: string;
  titleEn: string;
  titleMn: string;
  bodyEn: string;
  bodyMn: string;
  updatedAt: string;
}

export function parseContentPage(d: components['schemas']['ContentPageResponse']): ContentPage {
  return {
    slug: d.slug ?? '',
    titleEn: d.titleEn ?? '',
    titleMn: d.titleMn ?? '',
    bodyEn: d.bodyEn ?? '',
    bodyMn: d.bodyMn ?? '',
    updatedAt: d.updatedAt ?? '',
  };
}

export function selectContentPageLocale(page: ContentPage, locale: string): { title: string; body: string } {
  const isMn = locale === 'mn';
  return {
    title: isMn ? page.titleMn : page.titleEn,
    body: isMn ? page.bodyMn : page.bodyEn,
  };
}
