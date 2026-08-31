const ACCENT = '#2a78d6';
const WIDTH = 600;
const HEIGHT = 160;
const PAD = 16;

export function LineChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = (WIDTH - PAD * 2) / Math.max(1, data.length - 1);

  const points = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: PAD + (HEIGHT - PAD * 2) * (1 - d.count / max),
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${HEIGHT - PAD} L ${points[0].x} ${HEIGHT - PAD} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }}>
      <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="var(--border)" strokeWidth={1} />
      <path d={areaPath} fill={ACCENT} fillOpacity={0.1} stroke="none" />
      <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <circle key={p.date} cx={p.x} cy={p.y} r={2} fill="transparent">
          <title>
            {p.date}: {p.count}
          </title>
        </circle>
      ))}
      <circle cx={last.x} cy={last.y} r={4} fill={ACCENT} stroke="var(--card)" strokeWidth={2} />
      <text x={last.x} y={last.y - 10} textAnchor="end" fontSize={11} fill="var(--foreground)" fontWeight={600}>
        {last.count}
      </text>
    </svg>
  );
}
