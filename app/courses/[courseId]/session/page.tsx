"use client";

import { use, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import { mockCourses, getQuestionsForCourse, getQuestionsForTopics } from "@/lib/mockData";

type Confidence = "unsure" | "guessed" | "confident" | null;
type Result = { questionId: string; correct: boolean; confidence: Confidence };

function SessionContent({ courseId }: { courseId: string }) {
  const course = mockCourses.find((c) => c.id === courseId) ?? mockCourses[0];
  const router = useRouter();
  const searchParams = useSearchParams();

  const topicsParam = searchParams.get("topics");
  const selectedTopicIds = topicsParam ? topicsParam.split(",").filter(Boolean) : [];

  const questions =
    selectedTopicIds.length > 0
      ? getQuestionsForTopics(courseId, selectedTopicIds)
      : getQuestionsForCourse(courseId);

  const sessionQuestions = questions.length > 0 ? questions : getQuestionsForCourse(courseId);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<Confidence>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const question = sessionQuestions[index];
  const progress = `${index + 1}/${sessionQuestions.length}`;

  if (!question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#8FAF76" }}>
        <p className="text-white font-bold">No questions available for the selected topics.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-2 rounded-full text-sm font-bold text-gray-800"
          style={{ backgroundColor: "#FEFEE8" }}
        >
          ← Back
        </button>
      </div>
    );
  }

  function handleSubmit() {
    if (!confidence) return;
    setSubmitted(true);
  }

  function handleResult(correct: boolean) {
    const updated = [...results, { questionId: question.id, correct, confidence }];
    setResults(updated);

    if (index + 1 >= sessionQuestions.length) {
      const encoded = encodeURIComponent(JSON.stringify(updated));
      router.push(`/courses/${courseId}/session/results?data=${encoded}`);
      return;
    }

    setIndex(index + 1);
    setAnswer("");
    setConfidence(null);
    setSubmitted(false);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          <span
            className="px-4 py-1 rounded-full text-xs font-bold text-gray-700"
            style={{ backgroundColor: "#D6EEF8" }}
          >
            {course.code} — Study Session
          </span>
        }
      />

      <main className="flex-1 flex items-center justify-center p-6">
        {/* Outer dark green card */}
        <div
          className="w-full max-w-2xl p-4 rounded-3xl shadow-xl"
          style={{ backgroundColor: "#7a9a63" }}
        >
          {/* Inner cream question card */}
          <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ backgroundColor: "#FEFEE8" }}>
            {/* Top bar */}
            <div className="flex justify-between">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-gray-700"
                style={{ backgroundColor: "#FEFEE8", border: "1.5px solid #d1d5db" }}
              >
                Question {index + 1}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-gray-700"
                style={{ backgroundColor: "#FEFEE8", border: "1.5px solid #d1d5db" }}
              >
                {progress}
              </span>
            </div>

            {/* Question text */}
            <p className="text-base font-semibold text-gray-800">{question.text}</p>

            {!submitted ? (
              <>
                {/* Answer area */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">
                    YOUR ANSWER (correct answer shown after submit)
                  </label>
                  <textarea
                    rows={4}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here…"
                    className="px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                  />
                </div>

                {/* Confidence */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-500 font-medium">CONFIDENCE LEVEL</label>
                  <div className="flex gap-3">
                    {(["unsure", "guessed", "confident"] as const).map((level) => {
                      const colors = {
                        unsure: "#FF6B6B",
                        guessed: "#F5C842",
                        confident: "#5CB85C",
                      };
                      return (
                        <button
                          key={level}
                          onClick={() => setConfidence(level)}
                          className="flex-1 py-2 rounded-full text-sm font-bold text-white capitalize transition-all"
                          style={{
                            backgroundColor: colors[level],
                            opacity: confidence && confidence !== level ? 0.45 : 1,
                            outline: confidence === level ? "2px solid #374151" : "none",
                            outlineOffset: "2px",
                          }}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!confidence}
                  className="w-full py-3 rounded-full text-sm font-bold text-gray-800 transition-opacity"
                  style={{
                    backgroundColor: "#F5C842",
                    opacity: confidence ? 1 : 0.5,
                    cursor: confidence ? "pointer" : "not-allowed",
                  }}
                >
                  SUBMIT
                </button>
              </>
            ) : (
              <>
                {/* Show correct answer */}
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-1">CORRECT ANSWER</p>
                  <p className="text-sm text-gray-800">{question.correctAnswer}</p>
                </div>

                <p className="text-xs font-semibold text-gray-600 text-center">
                  How did you do?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleResult(false)}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#FF6B6B" }}
                  >
                    Incorrect
                  </button>
                  <button
                    onClick={() => handleResult(true)}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#5CB85C" }}
                  >
                    Correct
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SessionPageWrapper({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#8FAF76" }} />}>
      <SessionContent courseId={courseId} />
    </Suspense>
  );
}
