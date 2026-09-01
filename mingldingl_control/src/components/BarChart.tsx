const ACCENT = 'var(--chart-accent)';
const CHART_HEIGHT = 160;

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-[2px]" style={{ height: CHART_HEIGHT + 40 }}>
      {data.map((d) => {
        const barHeight = Math.round((d.value / max) * CHART_HEIGHT);
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: CHART_HEIGHT + 40 }}>
            <span className="text-foreground mb-1 text-xs font-medium">{d.value}</span>
            <div
              title={`${d.label}: ${d.value}`}
              className="w-full max-w-6 rounded-t"
              style={{ height: Math.max(2, barHeight), backgroundColor: ACCENT }}
            />
            <div className="bg-border mt-1 h-px w-full" />
            <span className="text-muted-foreground mt-1 max-w-full truncate text-[11px]" title={d.label}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
