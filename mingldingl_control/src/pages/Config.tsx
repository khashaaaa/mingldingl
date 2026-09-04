import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfigField } from '@/components/ConfigField';
import { useToast } from '@/hooks/use-toast';
import { serverError } from '@/lib/apiError';

export function Config() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: queryKeys.config,
    queryFn: () => apiClient.config.list(),
  });

  const update = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => apiClient.config.update(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config });
      toast({ variant: 'success', description: 'Saved.' });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed — try again.';
      toast({ variant: 'destructive', description: message });
    },
  });

  const revert = useMutation({
    mutationFn: (key: string) => apiClient.config.revert(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config });
      toast({ variant: 'success', description: 'Reverted.' });
    },
    onError: (err) => toast({ variant: 'destructive', description: serverError(err, 'Revert failed — try again.') }),
  });

  const categories = entries ? [...new Set(entries.map((e) => e.category))] : [];

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
      {isError && <p className="text-destructive text-sm">Couldn't load config.</p>}

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
                  isSaving={update.isPending || revert.isPending}
                  onSave={(value) => update.mutate({ key: entry.key ?? '', value })}
                  onRevert={() => revert.mutate(entry.key ?? '')}
                />
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
