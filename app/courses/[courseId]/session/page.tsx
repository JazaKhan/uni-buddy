"use client";

import { use, useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";

type Question = {
  id: string;
  content: string;
  answer: string | null;
  topics: { id: string; name: string }[];
  outcomes: { id: string; name: string }[];
};

type Confidence = "guessed" | "unsure" | "confident" | null;

function SessionContent({ courseId }: { courseId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<Confidence>(null);
  const [submitted, setSubmitted] = useState(false);
  const [logging, setLogging] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      const topicsParam = searchParams.get("topics") ?? "";
      const outcomesParam = searchParams.get("outcomes") ?? "";
      const selectedTopicIds = topicsParam.split(",").filter(Boolean);
      const selectedOutcomeIds = outcomesParam.split(",").filter(Boolean);

      const [questionsRes, sessionRes, courseRes] = await Promise.all([
        fetch(`/api/courses/${courseId}/questions`),
        fetch(`/api/courses/${courseId}/sessions`, { method: "POST" }),
        fetch(`/api/courses/${courseId}`),
      ]);

      if (!questionsRes.ok || !sessionRes.ok || !courseRes.ok) { router.push("/dashboard"); return; }

      const allQuestions: Question[] = await questionsRes.json();
      const { id } = await sessionRes.json();
      await courseRes.json();

      let filtered = allQuestions;

      if (selectedOutcomeIds.length > 0) {
        filtered = allQuestions.filter((q) =>
          q.outcomes.some((o) => selectedOutcomeIds.includes(o.id))
        );
      } else if (selectedTopicIds.length > 0) {
        filtered = allQuestions.filter((q) =>
          q.topics.some((t) => selectedTopicIds.includes(t.id))
        );
      }

      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setSessionId(id);
      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const question = questions[index];

  function handleSubmit() {
    if (!confidence) return;
    setSubmitted(true);
  }

  async function handleResult(correct: boolean) {
    if (!sessionId || !question) return;
    setLogging(true);

    await fetch(`/api/sessions/${sessionId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, isCorrect: correct, confidence }),
    });

    setLogging(false);

    if (index + 1 >= questions.length) {
      router.push(`/courses/${courseId}/session/results?sessionId=${sessionId}`);
      return;
    }

    setIndex(index + 1);
    setAnswer("");
    setConfidence(null);
    setSubmitted(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#8FAF76" }}>
        <p className="text-white font-semibold">Setting up session…</p>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          <span className="px-4 py-1 rounded-full text-xs font-bold text-gray-700" style={{ backgroundColor: "#D6EEF8" }}>
            Study Session
          </span>
        }
      />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl p-4 rounded-3xl shadow-xl" style={{ backgroundColor: "#7a9a63" }}>
          <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ backgroundColor: "#FEFEE8" }}>
            <div className="flex justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-bold text-gray-700" style={{ backgroundColor: "#FEFEE8", border: "1.5px solid #d1d5db" }}>
                Question {index + 1}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold text-gray-700" style={{ backgroundColor: "#FEFEE8", border: "1.5px solid #d1d5db" }}>
                {index + 1}/{questions.length}
              </span>
            </div>

            <p className="text-base font-semibold text-gray-800">{question.content}</p>

            {!submitted ? (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">YOUR ANSWER (correct answer shown after submit)</label>
                  <textarea
                    rows={4}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here…"
                    className="px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-500 font-medium">CONFIDENCE LEVEL</label>
                  <div className="flex gap-3">
                    {(["unsure", "guessed", "confident"] as const).map((level) => {
                      const colors = { unsure: "#FF6B6B", guessed: "#F5C842", confident: "#5CB85C" };
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

                <button
                  onClick={handleSubmit}
                  disabled={!confidence}
                  className="w-full py-3 rounded-full text-sm font-bold text-gray-800 transition-opacity"
                  style={{ backgroundColor: "#F5C842", opacity: confidence ? 1 : 0.5, cursor: confidence ? "pointer" : "not-allowed" }}
                >
                  SUBMIT
                </button>
              </>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-1">CORRECT ANSWER</p>
                  <p className="text-sm text-gray-800">{question.answer ?? "No answer provided."}</p>
                </div>

                <p className="text-xs font-semibold text-gray-600 text-center">How did you do?</p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleResult(false)}
                    disabled={logging}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: "#FF6B6B" }}
                  >
                    Incorrect
                  </button>
                  <button
                    onClick={() => handleResult(true)}
                    disabled={logging}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 disabled:opacity-50"
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

export default function SessionPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#8FAF76" }} />}>
      <SessionContent courseId={courseId} />
    </Suspense>
  );
}
