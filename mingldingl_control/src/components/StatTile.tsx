import { Card } from '@/components/ui/card';

export function StatTile({ label, value, caption }: { label: string; value: string | number; caption?: string }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {caption && <p className="text-muted-foreground text-xs">{caption}</p>}
    </Card>
  );
}
