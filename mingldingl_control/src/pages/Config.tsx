import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfigField, type LadderBounds } from '@/components/ConfigField';
import type { components } from '@/lib/api/api.generated';

type AdminConfigDto = components['schemas']['AdminConfigDto'];

// ScoreService's ladder above the fixed Garnet floor (0); the engine checks each against its neighbours.
const TIER_KEYS = ['opal', 'amethyst', 'sapphire', 'ruby', 'emerald'].map((t) => `tier.${t}.threshold`);
const REVEAL_KEY = /^reveal\.level(\d+)\.messages$/;

function ladderBounds(entries: AdminConfigDto[]): Map<string, LadderBounds> {
  const values = new Map(entries.map((e) => [e.key ?? '', Number(e.value)]));
  const at = (key: string | undefined) => (key !== undefined && values.has(key) ? values.get(key)! : null);
  const bounds = new Map<string, LadderBounds>();

  TIER_KEYS.forEach((key, i) => {
    bounds.set(key, { lower: i === 0 ? 0 : at(TIER_KEYS[i - 1]), upper: at(TIER_KEYS[i + 1]), noun: 'tiers' });
  });

  const revealKeys = entries
    .map((e) => e.key ?? '')
    .filter((k) => REVEAL_KEY.test(k))
    .sort((a, b) => Number(REVEAL_KEY.exec(a)![1]) - Number(REVEAL_KEY.exec(b)![1]));
  revealKeys.forEach((key, i) => {
    bounds.set(key, { lower: at(revealKeys[i - 1]), upper: at(revealKeys[i + 1]), noun: 'reveal levels' });
  });

  return bounds;
}

export function Config() {
  const { data: entries, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.config,
    queryFn: () => apiClient.config.list(),
  });

  const categories = entries ? [...new Set(entries.map((e) => e.category))] : [];
  const ladders = entries ? ladderBounds(entries) : new Map<string, LadderBounds>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Config</h1>
        <p className="text-muted-foreground text-sm">
          Live levers for the economy, pacing, pricing, and feature availability. Each number has a safe range
          and tier thresholds must stay in order; the engine refuses anything outside that. Score changes apply
          to future events only.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && (
        <p className="text-destructive text-sm">
          Couldn't load config.{' '}
          <button type="button" className="underline" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-sm">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            {entries!
              .filter((e) => e.category === category)
              .map((entry) => (
                <ConfigField
                  key={`${entry.key}-${entry.updatedAt}`}
                  entry={entry}
                  ladder={ladders.get(entry.key ?? '')}
                />
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
