import type { components } from '../lib/api/api.generated';

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
