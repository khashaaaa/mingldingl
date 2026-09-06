import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { components } from '@/lib/api/api.generated';

type AdminConfigDto = components['schemas']['AdminConfigDto'];

const fmt = (n: number) => n.toLocaleString();

/** The registry bounds the engine checks a write against, as a readable range. */
function rangeLabel(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `Allowed ${fmt(min)}–${fmt(max)}`;
  if (min != null) return `Minimum ${fmt(min)}`;
  if (max != null) return `Maximum ${fmt(max)}`;
  return null;
}

function outOfRange(draft: string, min?: number | null, max?: number | null): boolean {
  const n = Number(draft);
  if (draft.trim() === '' || Number.isNaN(n)) return false;
  return (min != null && n < min) || (max != null && n > max);
}

function ValueEditor({
  valueType,
  value,
  min,
  max,
  invalid,
  onChange,
}: {
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
        <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true ? 'true' : 'false')} />
        {checked ? 'true' : 'false'}
      </label>
    );
  }
  if (kind === 'number') {
    return (
      <Input
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
  return <Input type="text" className="w-64" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function ConfigField({
  entry,
  onSave,
  onRevert,
  isSaving,
}: {
  entry: AdminConfigDto;
  onSave: (value: string) => void;
  onRevert: () => void;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState(entry.value ?? '');
  const isDirty = draft !== (entry.value ?? '');
  // The engine enforces these on write; showing them here means an admin reads the range instead
  // of discovering it by being rejected.
  const range = rangeLabel(entry.min, entry.max);
  const invalid = outOfRange(draft, entry.min, entry.max);

  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="flex-1">
        <p className="text-sm font-medium">{entry.key}</p>
        <p className="text-muted-foreground text-sm">{entry.description}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {range && <span className="mr-2 tabular-nums">{range}.</span>}
          Last changed by {entry.updatedBy} at {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '—'}
        </p>
        {invalid && range && (
          <p className="text-destructive mt-1 text-xs">{range} — the engine will refuse this value.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ValueEditor
          valueType={entry.valueType}
          value={draft}
          min={entry.min}
          max={entry.max}
          invalid={invalid}
          onChange={setDraft}
        />
        <Button size="sm" disabled={!isDirty || isSaving || invalid} onClick={() => onSave(draft)}>
          Save
        </Button>
        <Button size="sm" variant="outline" disabled={isSaving} onClick={onRevert}>
          Revert
        </Button>
      </div>
    </div>
  );
}
