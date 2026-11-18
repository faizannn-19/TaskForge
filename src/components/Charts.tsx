import { useState } from 'react';
import { PriorityLevel, TaskStatus } from '../types/models';

export function StatusDonutChart({
  counts,
}: {
  counts: Record<TaskStatus, number>;
}) {
  const total = counts.todo + counts.in_progress + counts.in_review + counts.done;
  const segments: Array<{ key: TaskStatus; label: string; count: number; color: string }> = [
    { key: 'todo', label: 'To Do', count: counts.todo, color: '#64748b' },
    { key: 'in_progress', label: 'In Progress', count: counts.in_progress, color: '#4f46e5' },
    { key: 'in_review', label: 'In Review', count: counts.in_review, color: '#d97706' },
    { key: 'done', label: 'Done', count: counts.done, color: '#16a34a' },
  ];

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-40 h-40 shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            className="text-slate-100 dark:text-slate-800"
          />
          {total > 0 &&
            segments.map((seg) => {
              if (seg.count === 0) return null;
              const fraction = seg.count / total;
              const dash = fraction * circumference;
              const offset = -cumulative * circumference;
              cumulative += fraction;
              return (
                <circle
                  key={seg.key}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="16"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {total}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Tasks</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
          return (
            <div key={seg.key} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">{seg.label}</span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="text-slate-900 dark:text-slate-100 font-semibold">{seg.count}</span>
                <span className="text-slate-400 w-9 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PriorityBarChart({
  counts,
}: {
  counts: Record<PriorityLevel, number>;
}) {
  const items: Array<{ key: PriorityLevel; label: string; count: number; bar: string }> = [
    { key: 'urgent', label: 'Urgent', count: counts.urgent, bar: 'bg-rose-600' },
    { key: 'high', label: 'High', count: counts.high, bar: 'bg-amber-500' },
    { key: 'medium', label: 'Medium', count: counts.medium, bar: 'bg-indigo-600' },
    { key: 'low', label: 'Low', count: counts.low, bar: 'bg-slate-400 dark:bg-slate-600' },
  ];

  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const widthPct = Math.round((item.count / max) * 100);
        return (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {item.count}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
              <div
                className={`h-full ${item.bar} transition-all duration-300`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VelocityTrendChart({
  points,
}: {
  points: Array<{ label: string; created: number; completed: number }>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(2, ...points.flatMap((p) => [p.created, p.completed]));

  const width = 620;
  const height = 180;
  const padX = 28;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const toCoords = (values: number[]) =>
    values.map((v, idx) => {
      const x = padX + (points.length > 1 ? (idx / (points.length - 1)) * plotW : plotW / 2);
      const y = padY + plotH - (v / maxVal) * plotH;
      return { x, y };
    });

  const createdCoords = toCoords(points.map((p) => p.created));
  const completedCoords = toCoords(points.map((p) => p.completed));

  const toPath = (coords: Array<{ x: number; y: number }>) =>
    coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-indigo-500 inline-block" />
            Created
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" />
            Completed
          </span>
        </div>
        {hoveredIdx !== null && points[hoveredIdx] && (
          <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {points[hoveredIdx].label}: {points[hoveredIdx].created} created ·{' '}
            {points[hoveredIdx].completed} done
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
        {[0, 0.5, 1].map((tick) => {
          const y = padY + plotH - tick * plotH;
          return (
            <line
              key={tick}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray="3 3"
            />
          );
        })}

        {points.length > 1 && (
          <>
            <path
              d={toPath(createdCoords)}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={toPath(completedCoords)}
              fill="none"
              stroke="#16a34a"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}

        {points.map((pt, idx) => {
          const cc = createdCoords[idx];
          const dc = completedCoords[idx];
          return (
            <g
              key={pt.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={cc.x - 14}
                y={padY}
                width={28}
                height={plotH}
                fill="transparent"
              />
              <circle cx={cc.x} cy={cc.y} r={hoveredIdx === idx ? 4 : 2.5} fill="#6366f1" />
              <circle cx={dc.x} cy={dc.y} r={hoveredIdx === idx ? 4 : 2.5} fill="#16a34a" />
              {(idx % 2 === 0 || idx === points.length - 1) && (
                <text
                  x={cc.x}
                  y={height - 2}
                  textAnchor="middle"
                  className="fill-slate-400 text-[9px] font-mono"
                >
                  {pt.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
