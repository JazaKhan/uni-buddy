"use client";

import type { Top10Outcome } from "./types";

export default function TopOutcomesPanel({
  top10,
  loading,
}: {
  top10: Top10Outcome[];
  loading: boolean;
}) {
  return (
    <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
      <h2 className="text-sm font-bold text-gray-800">Top 10 Outcomes to Practice</h2>
      <p className="text-xs text-gray-500">Ranked worst to best — focus here first</p>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : top10.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          Practice some questions first — your weakest outcomes will appear here.
        </p>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
          {top10.map((lo, i) => (
            <div key={lo.id} className={`flex items-center gap-3 ${lo.practiced ? "" : "opacity-60"}`}>
              <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
              <div className="flex-1">
                <p className="text-xs text-gray-700">{lo.name}</p>
                <div className="w-full h-1.5 rounded-full bg-gray-200 mt-1">
                  {lo.practiced && lo.mastery !== null ? (
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${lo.mastery}%`,
                        backgroundColor: lo.mastery < 50 ? "#FF6B6B" : lo.mastery < 70 ? "#F5C842" : "#5CB85C",
                      }}
                    />
                  ) : null}
                </div>
              </div>
              {lo.practiced && lo.mastery !== null ? (
                <span className="text-xs text-gray-500 shrink-0">{lo.mastery}%</span>
              ) : (
                <span className="text-xs text-gray-400 italic shrink-0">Not practiced yet</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
