/**
 * One series as a gold ink line over four quiet rules (Figma S8 39:126's panels): the axis numbers on
 * the left, the first and last day under it, a dot on the latest value. Colours come from tokens.
 */
export function LineChart({ values, first, last }: { values: number[]; first: string; last: string }) {
  const w = 284;
  const h = 180;
  // Whole-number rules: three steps of a round size that covers the highest value.
  const min = Math.min(0, ...values);
  const unit = Math.max(1, Math.ceil((Math.max(1, ...values) - min) / 3));
  const max = min + unit * 3;
  const span = max - min;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const y = (v: number) => h - ((v - min) / span) * h;
  const points = values.map((v, i) => `${(44 + i * step).toFixed(1)},${(20 + y(v)).toFixed(1)}`).join(' ');
  const rules = [0, 1, 2, 3].map((i) => min + unit * i);
  const lastPoint = values.length
    ? { x: 44 + (values.length - 1) * step, y: 20 + y(values[values.length - 1]) }
    : null;
  return (
    <svg className="line-chart" viewBox="0 0 340 230" role="img" aria-label={`${values.length} days`}>
      {rules.map((r) => (
        <g key={r}>
          <line x1={44} x2={328} y1={20 + y(r)} y2={20 + y(r)} className="line-chart-rule" />
          <text x={36} y={24 + y(r)} textAnchor="end" className="line-chart-label">
            {Math.round(r).toLocaleString('en-US')}
          </text>
        </g>
      ))}
      <polyline points={points} className="line-chart-line" />
      {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r={4} className="line-chart-dot" />}
      <text x={44} y={222} className="line-chart-label">
        {first}
      </text>
      <text x={328} y={222} textAnchor="end" className="line-chart-label">
        {last}
      </text>
    </svg>
  );
}
