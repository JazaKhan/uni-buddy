"use client";

import type { MasteryPoint } from "./types";

function MasteryChart({ history, currentMastery }: { history: MasteryPoint[]; currentMastery: number }) {
  const W = 400;
  const H = 120;
  const padX = 28;
  const padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const color =
    currentMastery < 50 ? "#FF6B6B" : currentMastery < 70 ? "#F5C842" : "#5CB85C";

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-xs text-center px-4">
        Complete a study session to see your progress over time
      </div>
    );
  }

  if (history.length === 1) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-2xl bg-gray-50 gap-1">
        <span className="text-xs text-gray-400">Session 1 complete</span>
        <span className="text-2xl font-black" style={{ color }}>{history[0].mastery}%</span>
        <span className="text-xs text-gray-400">Do another session to see your trend</span>
      </div>
    );
  }

  const xStep = innerW / (history.length - 1);
  const points = history.map((p, i) => ({
    x: padX + i * xStep,
    y: padY + innerH - (p.mastery / 100) * innerH,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `M${points[0].x},${padY + innerH}`,
    ...points.map((p) => `L${p.x},${p.y}`),
    `L${points[points.length - 1].x},${padY + innerH}`,
    "Z",
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mg)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} />
      ))}
      {[0, 50, 100].map((pct) => {
        const y = padY + innerH - (pct / 100) * innerH;
        return (
          <g key={pct}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3" />
            <text x={padX - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{pct}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function MasteryPanel({
  courseMastery,
  masteryHistory,
}: {
  courseMastery: number;
  masteryHistory: MasteryPoint[];
}) {
  const color =
    courseMastery < 50 ? "#FF6B6B" : courseMastery < 70 ? "#F5C842" : "#5CB85C";

  return (
    <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-gray-800">Course Mastery</h2>
        <span className="text-3xl font-black" style={{ color }}>{courseMastery}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${courseMastery}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Progress over time</p>
      <MasteryChart history={masteryHistory} currentMastery={courseMastery} />
    </div>
  );
}
