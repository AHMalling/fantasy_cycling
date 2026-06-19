import { Snapshot } from "../lib/api";

interface Props {
  snapshots: Snapshot[];
  height?: number;
}

export default function ScoreChart({ snapshots, height = 160 }: Props) {
  if (snapshots.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        Not enough data yet — check back after the next daily snapshot.
      </p>
    );
  }

  const W = 600;
  const H = height;
  const PAD = { top: 12, right: 16, bottom: 28, left: 60 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const scores = snapshots.map((s) => s.total_score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const px = (i: number) =>
    PAD.left + (snapshots.length === 1 ? cw / 2 : (i / (snapshots.length - 1)) * cw);
  const py = (score: number) =>
    PAD.top + (1 - (score - minS) / range) * ch;

  const pathD = snapshots
    .map((s, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(s.total_score)}`)
    .join(" ");

  // 4 evenly-spaced y-axis ticks
  const yTicks = [0, 1 / 3, 2 / 3, 1].map((t) => ({
    y: PAD.top + (1 - t) * ch,
    label: Math.round(minS + t * range).toLocaleString(),
  }));

  // Show first, last, and up to 3 interior date labels
  const labelIndices = new Set<number>([0, snapshots.length - 1]);
  if (snapshots.length > 4) {
    const mid = Math.floor(snapshots.length / 2);
    labelIndices.add(mid);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Score over time"
      role="img"
    >
      {/* Y-axis grid + labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={t.y}
            x2={PAD.left + cw}
            y2={t.y}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={t.y}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={10}
            fill="#9ca3af"
          >
            {t.label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path
        d={`${pathD} L${px(snapshots.length - 1)},${PAD.top + ch} L${px(0)},${PAD.top + ch} Z`}
        fill="#eab308"
        fillOpacity={0.1}
      />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="#eab308"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {snapshots.map((s, i) => (
        <circle
          key={i}
          cx={px(i)}
          cy={py(s.total_score)}
          r={3.5}
          fill="#eab308"
          stroke="white"
          strokeWidth={1.5}
        >
          <title>
            {s.date}: {s.total_score.toLocaleString()} pts
            {s.rank != null ? ` · Rank #${s.rank}` : ""}
          </title>
        </circle>
      ))}

      {/* X-axis date labels */}
      {snapshots.map((s, i) => {
        if (!labelIndices.has(i)) return null;
        const isFirst = i === 0;
        const isLast = i === snapshots.length - 1;
        return (
          <text
            key={i}
            x={px(i)}
            y={H - 4}
            fontSize={10}
            fill="#9ca3af"
            textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
          >
            {s.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}
