import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { components } from '@/lib/api/api.generated';

type AdminConfigDto = components['schemas']['AdminConfigDto'];

export function ConfigField({
  entry,
  onSave,
  onRevert,
  isSaving,
  canRevert,
}: {
  entry: AdminConfigDto;
  onSave: (value: string) => void;
  onRevert: () => void;
  isSaving: boolean;
  canRevert: boolean;
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
        <Input
          type="number"
          className="w-28"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button size="sm" disabled={!isDirty || isSaving} onClick={() => onSave(draft)}>
          Save
        </Button>
        <Button size="sm" variant="outline" disabled={!canRevert || isSaving} onClick={onRevert}>
          Revert
        </Button>
      </div>
    </div>
  );
}
