import type { CityView } from '@/lib/api/generated/model';
import { tPlace as placeName } from '@/lib/i18n';

/** The capital's name — the one place that holds others (its districts). */
export const CAPITAL = 'Ulaanbaatar';

/** A district's name without the "(UB)" that only tells it apart from a namesake in the provinces. */
const bare = (name: string) => name.replace(/ \(UB\)$/, '');

/** How a stored place reads on a field: "Bayangol, Ulaanbaatar", "Erdenet, Orkhon", "Ulaanbaatar". */
export function cityLabel(c: Pick<CityView, 'name' | 'region'>): string {
  return c.name === c.region ? placeName(c.name) : `${placeName(c.name)}, ${placeName(c.region)}`;
}

export type CityRow =
  /** Ulaanbaatar, among the provinces; opens to its districts. */
  | { kind: 'capital'; city: CityView; open: boolean }
  /** Inside the open capital: the city as a whole, for someone who will not name a district. */
  | { kind: 'whole'; city: CityView }
  | { kind: 'place'; city: CityView; label: string; nested: boolean };

/** Case, accents and х's two spellings (Arkhangai / Arhangai) do not matter to a search. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/kh/g, 'h');

/**
 * The picker's one list: Ulaanbaatar first among the provinces, its districts tiered inside it, then
 * the provinces by name. Unsearched, the capital is open only when `capitalOpen`, and a province
 * reads by its own name (Arkhangai); searched, the capital opens on any district match (all of them
 * when the capital itself matches) and a province reads by its centre and province (Erdenet, Orkhon)
 * so the match is visible. A search matches either name, ignoring accents (Ölgii ← "olgii").
 */
export function cityRows(cities: CityView[], query: string, capitalOpen: boolean): CityRow[] {
  const q = fold(query.trim());
  const hit = (c: CityView) =>
    !q || [c.name, c.region, placeName(c.name), placeName(c.region)].some((n) => fold(n).includes(q));
  const rows: CityRow[] = [];
  const capital = cities.find((c) => c.kind === 'capital');
  if (capital) {
    const all = cities.filter((c) => c.kind === 'district').sort((a, b) => a.name.localeCompare(b.name));
    const districts =
      q && !hit(capital)
        ? all.filter((c) => [bare(c.name), placeName(c.name)].some((n) => fold(n).includes(q)))
        : all;
    const open = q ? hit(capital) || districts.length > 0 : capitalOpen;
    if (!q || open) {
      rows.push({ kind: 'capital', city: capital, open });
      if (open) {
        if (!q || hit(capital)) rows.push({ kind: 'whole', city: capital });
        for (const city of districts)
          rows.push({ kind: 'place', city, label: placeName(city.name), nested: true });
      }
    }
  }
  for (const city of cities
    .filter((c) => c.kind === 'province' && hit(c))
    .sort((a, b) => a.region.localeCompare(b.region)))
    rows.push({ kind: 'place', city, label: q ? cityLabel(city) : placeName(city.region), nested: false });
  return rows;
}

/** The listed place closest to a position, by great-circle distance. */
export function nearestCity(cities: CityView[], lat: number, lng: number): CityView | undefined {
  const rad = Math.PI / 180;
  const dist = (c: CityView) => {
    const dLat = (c.lat - lat) * rad;
    const dLng = (c.lng - lng) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(c.lat * rad) * Math.sin(dLng / 2) ** 2;
    return Math.asin(Math.sqrt(a));
  };
  let best: CityView | undefined;
  for (const c of cities) if (!best || dist(c) < dist(best)) best = c;
  return best;
}
