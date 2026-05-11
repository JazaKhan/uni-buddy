"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";

type ConfidenceBreakdown = { CONFIDENT: number; UNSURE: number; GUESSED: number };
type RankedOutcome = { id: string; name: string; score: number };
type ResultsData = {
  total: number;
  correct: number;
  confidenceBreakdown: ConfidenceBreakdown;
  rankedOutcomes: RankedOutcome[];
};

function ResultsContent({ courseId }: { courseId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [results, setResults] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { router.push(`/courses/${courseId}`); return; }
    fetch(`/api/sessions/${sessionId}/results`)
      .then((r) => r.json())
      .then((data) => { setResults(data); setLoading(false); })
      .catch(() => router.push(`/courses/${courseId}`));
  }, [sessionId, courseId, router]);

  if (loading || !results) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
        <NavBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-white font-semibold">Loading results…</p>
        </main>
      </div>
    );
  }

  const { total, correct, confidenceBreakdown, rankedOutcomes } = results;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const confLabel =
    confidenceBreakdown.CONFIDENT >= confidenceBreakdown.GUESSED &&
    confidenceBreakdown.CONFIDENT >= confidenceBreakdown.UNSURE
      ? "Mostly Confident"
      : confidenceBreakdown.GUESSED >= confidenceBreakdown.UNSURE
      ? "Mostly Guessed"
      : "Mostly Unsure";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          <span className="px-4 py-1 rounded-full text-xs font-bold text-gray-700" style={{ backgroundColor: "#D6EEF8" }}>
            Session Results
          </span>
        }
      />

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl shadow-lg flex flex-col items-center gap-2" style={{ backgroundColor: "#FEFEE8" }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Score</p>
            <p className="text-5xl font-black text-gray-800">{correct}</p>
            <p className="text-sm text-gray-500">out of {total}</p>
            <div className="w-full h-2 rounded-full bg-gray-200 mt-2">
              <div className="h-2 rounded-full" style={{ width: `${scorePercent}%`, backgroundColor: "#5CB85C" }} />
            </div>
            <p className="text-xs text-gray-500">{scorePercent}%</p>
          </div>

          <div className="p-6 rounded-3xl shadow-lg flex flex-col items-center gap-2" style={{ backgroundColor: "#FEFEE8" }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Overall Confidence</p>
            <p className="text-2xl font-black text-gray-800 mt-2">{confLabel}</p>
            <div className="flex flex-col gap-1 w-full mt-2">
              {([
                { label: "Confident", count: confidenceBreakdown.CONFIDENT, color: "#5CB85C" },
                { label: "Guessed", count: confidenceBreakdown.GUESSED, color: "#F5C842" },
                { label: "Unsure", count: confidenceBreakdown.UNSURE, color: "#FF6B6B" },
              ] as const).map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-16">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: total > 0 ? `${Math.round((item.count / total) * 100)}%` : "0%", backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-4">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
          <h2 className="text-sm font-bold text-gray-800">Ranked Learning Outcomes</h2>
          <p className="text-xs text-gray-500">Worst performers first — focus your revision here</p>
          {rankedOutcomes.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No outcomes were tagged to the questions in this session.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rankedOutcomes.map((lo, i) => (
                <div key={lo.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                  <p className="text-xs font-semibold text-gray-700 flex-1">{lo.name}</p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: lo.score < 50 ? "#FF6B6B" : lo.score < 70 ? "#F5C842" : "#5CB85C" }}
                  >
                    {lo.score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push(`/courses/${courseId}`)}
            className="px-8 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FF6B6B" }}
          >
            Exit
          </button>
          <button
            onClick={() => router.push(`/courses/${courseId}/session/setup`)}
            className="px-8 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#5CB85C" }}
          >
            New Session
          </button>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#8FAF76" }} />}>
      <ResultsContent courseId={courseId} />
    </Suspense>
  );
}
