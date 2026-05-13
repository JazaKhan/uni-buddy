"use client";

import { use, useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";

type QuestionType = "WRITTEN" | "MULTIPLE_CHOICE" | "FILL_IN_BLANK";
type MCOption = { id: string; text: string; isCorrect: boolean };
type Confidence = "guessed" | "unsure" | "confident";

type Question = {
  id: string;
  content: string;
  answer: string | null;
  type: QuestionType;
  options: MCOption[] | null;
  blanks: string[] | null;
  topics: { id: string; name: string }[];
  outcomes: { id: string; name: string }[];
};

function SessionContent({ courseId }: { courseId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [logging, setLogging] = useState(false);
  const initialized = useRef(false);

  // Written state
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [writtenSubmitted, setWrittenSubmitted] = useState(false);
  const [writtenConfidence, setWrittenConfidence] = useState<Confidence | null>(null);

  // MC state
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());

  // FIB state
  const [blankInputs, setBlankInputs] = useState<string[]>([]);
  const [blankResults, setBlankResults] = useState<boolean[]>([]);

  // Shared checked state for MC + FIB
  const [checked, setChecked] = useState(false);
  const [autoCorrect, setAutoCorrect] = useState<boolean | null>(null);
  const [checkedConfidence, setCheckedConfidence] = useState<Confidence | null>(null);

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
        filtered = allQuestions.filter((q) => q.outcomes.some((o) => selectedOutcomeIds.includes(o.id)));
      } else if (selectedTopicIds.length > 0) {
        filtered = allQuestions.filter((q) => q.topics.some((t) => selectedTopicIds.includes(t.id)));
      }

      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setSessionId(id);
      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset per-question state when index changes
  useEffect(() => {
    const q = questions[index];
    setWrittenAnswer("");
    setWrittenSubmitted(false);
    setWrittenConfidence(null);
    setSelectedOptionIds(new Set());
    setBlankInputs(q?.blanks ? Array(q.blanks.length).fill("") : []);
    setBlankResults([]);
    setChecked(false);
    setAutoCorrect(null);
    setCheckedConfidence(null);
  }, [index, questions]);

  const question = questions[index];

  async function logAttempt(isCorrect: boolean, confidence: Confidence) {
    if (!sessionId || !question) return;
    setLogging(true);
    await fetch(`/api/sessions/${sessionId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, isCorrect, confidence }),
    });
    setLogging(false);

    if (index + 1 >= questions.length) {
      router.push(`/courses/${courseId}/session/results?sessionId=${sessionId}`);
      return;
    }
    setIndex(index + 1);
  }

  function handleWrittenSubmit() {
    if (!writtenConfidence) return;
    setWrittenSubmitted(true);
  }

  function handleCheck() {
    if (!question) return;
    if (question.type === "MULTIPLE_CHOICE") {
      const options = question.options ?? [];
      const correctIds = new Set(options.filter((o) => o.isCorrect).map((o) => o.id));
      const correct =
        selectedOptionIds.size === correctIds.size &&
        [...selectedOptionIds].every((id) => correctIds.has(id));
      setAutoCorrect(correct);
    } else if (question.type === "FILL_IN_BLANK") {
      const blanks = question.blanks ?? [];
      const results = blankInputs.map((input, i) =>
        input.trim().toLowerCase() === (blanks[i] ?? "").trim().toLowerCase()
      );
      setBlankResults(results);
      setAutoCorrect(results.every((r) => r));
    }
    setChecked(true);
  }

  function toggleMCOption(id: string) {
    if (!question?.options) return;
    const correctCount = question.options.filter((o) => o.isCorrect).length;
    if (correctCount > 1) {
      setSelectedOptionIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedOptionIds(new Set([id]));
    }
  }

  const confidenceColors: Record<Confidence, string> = { guessed: "#F5C842", unsure: "#FF6B6B", confident: "#5CB85C" };

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
              <span className="px-3 py-1 rounded-full text-xs font-bold text-gray-700" style={{ border: "1.5px solid #d1d5db" }}>
                Question {index + 1}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold text-gray-700" style={{ border: "1.5px solid #d1d5db" }}>
                {index + 1}/{questions.length}
              </span>
            </div>

            <p className="text-base font-semibold text-gray-800">{question.content}</p>

            {/* ── WRITTEN ── */}
            {question.type === "WRITTEN" && !writtenSubmitted && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">YOUR ANSWER</label>
                  <textarea
                    rows={4}
                    value={writtenAnswer}
                    onChange={(e) => setWrittenAnswer(e.target.value)}
                    placeholder="Type your answer here…"
                    className="px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-500 font-medium">CONFIDENCE LEVEL</label>
                  <div className="flex gap-3">
                    {(["guessed", "unsure", "confident"] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setWrittenConfidence(level)}
                        className="flex-1 py-2 rounded-full text-sm font-bold text-white capitalize transition-all"
                        style={{
                          backgroundColor: confidenceColors[level],
                          opacity: writtenConfidence && writtenConfidence !== level ? 0.45 : 1,
                          outline: writtenConfidence === level ? "2px solid #374151" : "none",
                          outlineOffset: "2px",
                        }}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleWrittenSubmit}
                  disabled={!writtenConfidence}
                  className="w-full py-3 rounded-full text-sm font-bold text-gray-800 transition-opacity"
                  style={{ backgroundColor: "#F5C842", opacity: writtenConfidence ? 1 : 0.5, cursor: writtenConfidence ? "pointer" : "not-allowed" }}
                >
                  SUBMIT
                </button>
              </>
            )}

            {question.type === "WRITTEN" && writtenSubmitted && (
              <>
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-1">CORRECT ANSWER</p>
                  <p className="text-sm text-gray-800">{question.answer ?? "No answer provided."}</p>
                </div>
                <p className="text-xs font-semibold text-gray-600 text-center">How did you do?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => logAttempt(false, writtenConfidence!)}
                    disabled={logging}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: "#FF6B6B" }}
                  >
                    Incorrect
                  </button>
                  <button
                    onClick={() => logAttempt(true, writtenConfidence!)}
                    disabled={logging}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: "#5CB85C" }}
                  >
                    Correct
                  </button>
                </div>
              </>
            )}

            {/* ── MULTIPLE CHOICE ── */}
            {question.type === "MULTIPLE_CHOICE" && (() => {
              const options = question.options ?? [];
              const correctIds = new Set(options.filter((o) => o.isCorrect).map((o) => o.id));
              return (
                <>
                  <div className="flex flex-col gap-2">
                    {options.map((opt) => {
                      const isSelected = selectedOptionIds.has(opt.id);
                      let bg = isSelected ? "#374151" : "#f3f4f6";
                      let textColor = isSelected ? "white" : "#374151";
                      let border = "transparent";
                      if (checked) {
                        if (opt.isCorrect && isSelected) { bg = "#dcfce7"; textColor = "#166534"; border = "#86efac"; }
                        else if (!opt.isCorrect && isSelected) { bg = "#fee2e2"; textColor = "#991b1b"; border = "#fca5a5"; }
                        else if (opt.isCorrect && !isSelected) { bg = "#fef9c3"; textColor = "#854d0e"; border = "#fde047"; }
                        else { bg = "#f3f4f6"; textColor = "#9ca3af"; }
                      }
                      return (
                        <button
                          key={opt.id}
                          onClick={() => !checked && toggleMCOption(opt.id)}
                          disabled={checked}
                          className="w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all"
                          style={{ backgroundColor: bg, color: textColor, border: `1.5px solid ${border}` }}
                        >
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>

                  {!checked && (
                    <button
                      onClick={handleCheck}
                      disabled={selectedOptionIds.size === 0}
                      className="w-full py-3 rounded-full text-sm font-bold text-gray-800 transition-opacity"
                      style={{ backgroundColor: "#F5C842", opacity: selectedOptionIds.size > 0 ? 1 : 0.5, cursor: selectedOptionIds.size > 0 ? "pointer" : "not-allowed" }}
                    >
                      Check Answer
                    </button>
                  )}

                  {checked && (
                    <>
                      <div className={`px-4 py-2 rounded-2xl text-sm font-bold text-center ${autoCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {autoCorrect ? "Correct!" : `Incorrect — correct: ${options.filter(o => o.isCorrect).map(o => o.text).join(", ")}`}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-500 font-medium text-center">CONFIDENCE LEVEL</label>
                        <div className="flex gap-3">
                          {(["guessed", "unsure", "confident"] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => { setCheckedConfidence(level); logAttempt(autoCorrect!, level); }}
                              disabled={logging || checkedConfidence !== null}
                              className="flex-1 py-2 rounded-full text-sm font-bold text-white capitalize transition-all disabled:opacity-50"
                              style={{ backgroundColor: confidenceColors[level] }}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {/* ── FILL IN THE BLANK ── */}
            {question.type === "FILL_IN_BLANK" && (() => {
              const blanks = question.blanks ?? [];
              return (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 font-medium">FILL IN THE BLANKS</label>
                    {blanks.map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-14 shrink-0">Blank {i + 1}:</span>
                        <input
                          type="text"
                          value={blankInputs[i] ?? ""}
                          onChange={(e) => setBlankInputs((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                          disabled={checked}
                          placeholder={`Answer ${i + 1}…`}
                          className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                          style={{
                            borderColor: checked
                              ? blankResults[i] ? "#86efac" : "#fca5a5"
                              : "#d1d5db",
                            backgroundColor: checked
                              ? blankResults[i] ? "#dcfce7" : "#fee2e2"
                              : "white",
                          }}
                        />
                        {checked && (
                          <span className="text-sm shrink-0">{blankResults[i] ? "✓" : "✗"}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {checked && (
                    <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200">
                      <p className="text-xs font-bold text-gray-500 mb-1">FULL ANSWER</p>
                      <p className="text-sm text-gray-800">{question.answer}</p>
                    </div>
                  )}

                  {!checked && (
                    <button
                      onClick={handleCheck}
                      disabled={blankInputs.some((b) => !b.trim())}
                      className="w-full py-3 rounded-full text-sm font-bold text-gray-800 transition-opacity"
                      style={{
                        backgroundColor: "#F5C842",
                        opacity: blankInputs.every((b) => b.trim()) ? 1 : 0.5,
                        cursor: blankInputs.every((b) => b.trim()) ? "pointer" : "not-allowed",
                      }}
                    >
                      Check Answer
                    </button>
                  )}

                  {checked && (
                    <>
                      <div className={`px-4 py-2 rounded-2xl text-sm font-bold text-center ${autoCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {autoCorrect ? "All correct!" : "Some blanks were incorrect."}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-500 font-medium text-center">CONFIDENCE LEVEL</label>
                        <div className="flex gap-3">
                          {(["guessed", "unsure", "confident"] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => { setCheckedConfidence(level); logAttempt(autoCorrect!, level); }}
                              disabled={logging || checkedConfidence !== null}
                              className="flex-1 py-2 rounded-full text-sm font-bold text-white capitalize transition-all disabled:opacity-50"
                              style={{ backgroundColor: confidenceColors[level] }}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
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
