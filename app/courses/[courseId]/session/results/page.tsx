"use client";

import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import NavBar from "@/components/NavBar";
import { mockCourses, mockSessionResults } from "@/lib/mockData";

function ResultsContent({ courseId }: { courseId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const course = mockCourses.find((c) => c.id === courseId) ?? mockCourses[0];

  let sessionData: Array<{ questionId: string; correct: boolean; confidence: string }> = [];
  try {
    const raw = searchParams.get("data");
    if (raw) sessionData = JSON.parse(decodeURIComponent(raw));
  } catch {
    // fall back to mock data
  }

  const total = sessionData.length || mockSessionResults.total;
  const correct = sessionData.length
    ? sessionData.filter((r) => r.correct).length
    : mockSessionResults.score;

  const confident = sessionData.filter((r) => r.confidence === "confident").length;
  const guessed = sessionData.filter((r) => r.confidence === "guessed").length;
  const unsure = sessionData.filter((r) => r.confidence === "unsure").length;
  const confLabel =
    confident > guessed && confident > unsure
      ? "Mostly Confident"
      : guessed > unsure
      ? "Mostly Guessed"
      : "Mostly Unsure";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          <span
            className="px-4 py-1 rounded-full text-xs font-bold text-gray-700"
            style={{ backgroundColor: "#D6EEF8" }}
          >
            {course.code} — Session Results
          </span>
        }
      />

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
        {/* Score + confidence cards */}
        <div className="grid grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl shadow-lg flex flex-col items-center gap-2" style={{ backgroundColor: "#FEFEE8" }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Score</p>
            <p className="text-5xl font-black text-gray-800">{correct}</p>
            <p className="text-sm text-gray-500">out of {total}</p>
            <div className="w-full h-2 rounded-full bg-gray-200 mt-2">
              <div
                className="h-2 rounded-full"
                style={{ width: `${Math.round((correct / total) * 100)}%`, backgroundColor: "#5CB85C" }}
              />
            </div>
            <p className="text-xs text-gray-500">{Math.round((correct / total) * 100)}%</p>
          </div>

          <div className="p-6 rounded-3xl shadow-lg flex flex-col items-center gap-2" style={{ backgroundColor: "#FEFEE8" }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Overall Confidence</p>
            <p className="text-2xl font-black text-gray-800 mt-2">{confLabel}</p>
            <div className="flex flex-col gap-1 w-full mt-2">
              {[
                { label: "Confident", count: confident || mockSessionResults.confidenceBreakdown.confident, color: "#5CB85C" },
                { label: "Guessed", count: guessed || mockSessionResults.confidenceBreakdown.guessed, color: "#F5C842" },
                { label: "Unsure", count: unsure || mockSessionResults.confidenceBreakdown.unsure, color: "#FF6B6B" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-16">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.round((item.count / total) * 100)}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-4">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ranked outcomes */}
        <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
          <h2 className="text-sm font-bold text-gray-800">Ranked Learning Outcomes & Suggestions</h2>
          <p className="text-xs text-gray-500">Worst performers first — focus your revision here</p>
          <div className="flex flex-col gap-3">
            {mockSessionResults.rankedOutcomes.map((lo, i) => (
              <div key={i} className="flex flex-col gap-1 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                  <p className="text-xs font-semibold text-gray-700 flex-1">{lo.text}</p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: lo.score < 50 ? "#FF6B6B" : lo.score < 70 ? "#F5C842" : "#5CB85C",
                      color: "white",
                    }}
                  >
                    {lo.score}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 pl-8">{lo.suggestion}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Exit / Retake */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push(`/courses/${courseId}`)}
            className="px-8 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FF6B6B" }}
          >
            Exit
          </button>
          <button
            onClick={() => router.push(`/courses/${courseId}/session`)}
            className="px-8 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#5CB85C" }}
          >
            Retake
          </button>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPageWrapper({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#8FAF76" }} />}>
      <ResultsContent courseId={courseId} />
    </Suspense>
  );
}
