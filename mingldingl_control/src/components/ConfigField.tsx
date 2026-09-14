import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { components } from '@/lib/api/api.generated';
import { apiClient } from '@/lib/api/apiClient';
import { queryKeys } from '@/lib/api/queryKeys';
import { serverError } from '@/lib/apiError';
import { useToast } from '@/hooks/use-toast';

type AdminConfigDto = components['schemas']['AdminConfigDto'];

/** Exclusive neighbours for a key on a strictly increasing ladder (gem tiers, reveal levels). */
export type LadderBounds = { lower: number | null; upper: number | null; noun: string };

const fmt = (n: number) => n.toLocaleString();

/** The registry bounds the engine checks a write against, as a readable range. */
function rangeLabel(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `Allowed ${fmt(min)}–${fmt(max)}`;
  if (min != null) return `Minimum ${fmt(min)}`;
  if (max != null) return `Maximum ${fmt(max)}`;
  return null;
}

function ladderLabel({ lower, upper, noun }: LadderBounds): string | null {
  if (lower !== null && upper !== null)
    return `Must be between ${fmt(lower)} and ${fmt(upper)} (exclusive) so ${noun} stay in order`;
  if (lower !== null) return `Must be above ${fmt(lower)} so ${noun} stay in order`;
  if (upper !== null) return `Must be below ${fmt(upper)} so ${noun} stay in order`;
  return null;
}

function numberError(draft: string, min?: number | null, max?: number | null, ladder?: LadderBounds): string | null {
  if (draft.trim() === '') return 'Enter a number.';
  const n = Number(draft);
  if (!Number.isFinite(n)) return 'Not a valid number.';
  if ((min != null && n < min) || (max != null && n > max))
    return `${rangeLabel(min, max)} — the engine will refuse this value.`;
  if (ladder && ((ladder.lower !== null && n <= ladder.lower) || (ladder.upper !== null && n >= ladder.upper)))
    return `${ladderLabel(ladder)} — the engine will refuse this value.`;
  return null;
}

function ValueEditor({
  id,
  label,
  valueType,
  value,
  min,
  max,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  valueType?: string | null;
  value: string;
  min?: number | null;
  max?: number | null;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const kind = (valueType ?? '').toLowerCase();
  if (kind === 'bool' || kind === 'boolean') {
    const checked = value.trim().toLowerCase() === 'true';
    return (
      <label className="flex w-28 items-center gap-2 text-sm">
        <Checkbox id={id} aria-label={label} checked={checked} onCheckedChange={(next) => onChange(next === true ? 'true' : 'false')} />
        {checked ? 'true' : 'false'}
      </label>
    );
  }
  if (kind === 'number') {
    return (
      <Input
        id={id}
        aria-label={label}
        type="number"
        className={`w-28${invalid ? ' border-destructive text-destructive' : ''}`}
        min={min ?? undefined}
        max={max ?? undefined}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return <Input id={id} aria-label={label} type="text" className="w-64 max-w-full" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function ConfigField({ entry, ladder }: { entry: AdminConfigDto; ladder?: LadderBounds }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = entry.key ?? '';
  const [draft, setDraft] = useState(entry.value ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const isDirty = draft !== (entry.value ?? '');
  const isNumber = (entry.valueType ?? '').toLowerCase() === 'number';
  // The engine enforces these on write; showing them here means an admin reads the range instead
  // of discovering it by being rejected.
  const range = rangeLabel(entry.min, entry.max);
  const order = ladder ? ladderLabel(ladder) : null;
  const validation = isNumber ? numberError(draft, entry.min, entry.max, ladder) : null;

  const update = useMutation({
    mutationFn: (value: string) => apiClient.config.update(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.config });
      toast({ variant: 'success', description: `Saved ${key}.` });
    },
    onError: (err) => setSaveError(serverError(err, 'Save failed — try again.')),
  });

  const revert = useMutation({
    mutationFn: () => apiClient.config.revert(key),
    onSuccess: () => {
      setConfirmRevert(false);
      qc.invalidateQueries({ queryKey: queryKeys.config });
      toast({ variant: 'success', description: `Reverted ${key}.` });
    },
    onError: (err) => {
      setConfirmRevert(false);
      setSaveError(serverError(err, 'Revert failed — try again.'));
    },
  });

  const revertTarget = useQuery({
    queryKey: ['auditLog', 'configRevertTarget', key],
    queryFn: () => apiClient.auditLog.lastConfigOldValue(key).then((v) => v ?? null),
    enabled: confirmRevert,
    staleTime: 0,
  });

  const busy = update.isPending || revert.isPending;
  const inputId = `config-${key}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="min-w-[16rem] flex-1">
        <label htmlFor={inputId} className="text-sm font-medium break-all">
          {key}
        </label>
        <p className="text-muted-foreground text-sm">{entry.description}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {range && <span className="mr-2 tabular-nums">{range}.</span>}
          {order && <span className="mr-2 tabular-nums">{order}.</span>}
          Last changed by {entry.updatedBy} at {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '—'}
        </p>
        {validation && <p className="text-destructive mt-1 text-xs">{validation}</p>}
        {saveError && (
          <p role="alert" className="text-destructive mt-1 text-xs">
            {saveError}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ValueEditor
          id={inputId}
          label={key}
          valueType={entry.valueType}
          value={draft}
          min={entry.min}
          max={entry.max}
          invalid={!!validation}
          onChange={(value) => {
            setDraft(value);
            setSaveError(null);
          }}
        />
        <Button
          size="sm"
          disabled={!isDirty || busy || !!validation}
          onClick={() => {
            setSaveError(null);
            update.mutate(draft);
          }}
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setSaveError(null);
            setConfirmRevert(true);
          }}
        >
          {revert.isPending ? 'Reverting…' : 'Revert'}
        </Button>
      </div>

      <Dialog open={confirmRevert} onOpenChange={(open) => !open && !revert.isPending && setConfirmRevert(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-all">Revert {key}?</DialogTitle>
            <DialogDescription>
              {revertTarget.isLoading
                ? 'Looking up the previous value…'
                : revertTarget.isError
                  ? `Couldn't look up the previous value. Reverting restores the value before its last change (currently ${entry.value}).`
                  : revertTarget.data != null
                    ? `This sets it back to ${revertTarget.data} (currently ${entry.value}).`
                    : `This restores the value before its last change (currently ${entry.value}); that change is too far back in the audit log to show here.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevert(false)} disabled={revert.isPending}>
              Cancel
            </Button>
            <Button disabled={revert.isPending || revertTarget.isLoading} onClick={() => revert.mutate()}>
              {revert.isPending ? 'Reverting…' : revertTarget.data != null ? `Revert to ${revertTarget.data}` : 'Revert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
