import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { components } from '@/lib/api/api.generated';

type AdminConfigDto = components['schemas']['AdminConfigDto'];

function ValueEditor({
  valueType,
  value,
  onChange,
}: {
  valueType?: string | null;
  value: string;
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
    return <Input type="number" className="w-28" value={value} onChange={(e) => onChange(e.target.value)} />;
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

  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="flex-1">
        <p className="text-sm font-medium">{entry.key}</p>
        <p className="text-muted-foreground text-sm">{entry.description}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Last changed by {entry.updatedBy} at {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '—'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ValueEditor valueType={entry.valueType} value={draft} onChange={setDraft} />
        <Button size="sm" disabled={!isDirty || isSaving} onClick={() => onSave(draft)}>
          Save
        </Button>
        <Button size="sm" variant="outline" disabled={isSaving} onClick={onRevert}>
          Revert
        </Button>
      </div>
    </div>
  );
}
