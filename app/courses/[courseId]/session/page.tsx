"use client";

import { use, useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";

type QuestionType = "WRITTEN" | "MULTIPLE_CHOICE" | "FILL_IN_BLANK";
type MCOption = { id: string; text: string; isCorrect: boolean };
type RawAiQuestion = {
  type: QuestionType;
  content: string;
  answer: string | null;
  options: MCOption[] | null;
  blanks: string[] | null;
  outcomeIds: string[];
  topicIds: string[];
};
type Confidence = "guessed" | "unsure" | "confident";

type Question = {
  id: string;
  content: string;
  answer: string | null;
  type: QuestionType;
  options: MCOption[] | null;
  blanks: string[] | null;
  isAiGenerated: boolean;
  // these are only present on unsaved AI questions
  outcomeIds?: string[];
  topicIds?: string[];
  topics: { id: string; name: string }[];
  outcomes: { id: string; name: string }[];
};

function genTempId() {
  return "tmp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function SessionContent({ courseId }: { courseId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Setting up session…");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [logging, setLogging] = useState(false);
  const [noNotesBanner, setNoNotesBanner] = useState(false);
  const initialized = useRef(false);

  // Written state
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [writtenConfidence, setWrittenConfidence] = useState<Confidence | null>(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiVerdict, setAiVerdict] = useState<{ result: "correct" | "partial" | "incorrect"; explanation: string; suggestedMark: boolean } | null>(null);
  const [aiCheckError, setAiCheckError] = useState<string | null>(null);
  const [userMark, setUserMark] = useState<boolean | null>(null);
  const [manualMode, setManualMode] = useState(false);

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
      const isAiMode = searchParams.get("ai") === "true";
      const selectedTopicIds = topicsParam.split(",").filter(Boolean);
      const selectedOutcomeIds = outcomesParam.split(",").filter(Boolean);

      const sessionRes = await fetch(`/api/courses/${courseId}/sessions`, { method: "POST" });
      if (!sessionRes.ok) { router.push("/dashboard"); return; }
      const { id } = await sessionRes.json();
      setSessionId(id);

      if (isAiMode) {
        setLoadingMsg("✨ Generating questions…");
        const count = parseInt(searchParams.get("count") ?? "10", 10);
        const genRes = await fetch(`/api/courses/${courseId}/generate-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicIds: selectedTopicIds, outcomeIds: selectedOutcomeIds, count }),
        });
        if (!genRes.ok) {
          const errData = await genRes.json().catch(() => ({}));
          setLoadError(errData.error ?? "AI generation failed. Check your learning outcomes and try again.");
          setLoading(false);
          return;
        }
        const { questions: rawQs, warning } = await genRes.json();
        if (warning === "no_notes") setNoNotesBanner(true);

        const aiQuestions: Question[] = (rawQs as RawAiQuestion[]).map((q) => ({
          ...q,
          id: genTempId(),
          isAiGenerated: true,
          topics: [],
          outcomes: [],
        }));

        const shuffled = [...aiQuestions].sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
        setLoading(false);
        return;
      }

      // Normal mode — filtering is done server-side by the questions API.
      const qParams = new URLSearchParams();
      if (selectedOutcomeIds.length > 0) qParams.set("outcomeIds", selectedOutcomeIds.join(","));
      else if (selectedTopicIds.length > 0) qParams.set("topicIds", selectedTopicIds.join(","));
      const paramStr = qParams.toString();

      const questionsRes = await fetch(
        `/api/courses/${courseId}/questions${paramStr ? `?${paramStr}` : ""}`
      );
      if (!questionsRes.ok) { router.push("/dashboard"); return; }

      const allQuestions: Question[] = await questionsRes.json();
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset per-question state when index changes
  useEffect(() => {
    const q = questions[index];
    setWrittenAnswer("");
    setWrittenConfidence(null);
    setAiChecking(false);
    setAiVerdict(null);
    setAiCheckError(null);
    setUserMark(null);
    setManualMode(false);
    setSelectedOptionIds(new Set());
    setBlankInputs(q?.blanks ? Array(q.blanks.length).fill("") : []);
    setBlankResults([]);
    setChecked(false);
    setAutoCorrect(null);
    setCheckedConfidence(null);
  }, [index, questions]);

  const question = questions[index];

  // Persist AI question to DB, replace temp id with real id
  async function persistAiQuestion(q: Question): Promise<string> {
    const res = await fetch(`/api/courses/${courseId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: q.content,
        answer: q.answer,
        type: q.type,
        options: q.options,
        blanks: q.blanks,
        outcomeIds: q.outcomeIds ?? [],
        topicIds: q.topicIds ?? [],
        isAiGenerated: true,
      }),
    });
    if (!res.ok) return q.id;
    const saved = await res.json();
    // Replace temp id in questions array
    setQuestions((prev) =>
      prev.map((pq) => (pq.id === q.id ? { ...pq, id: saved.id } : pq))
    );
    return saved.id;
  }

  async function logAttempt(isCorrect: boolean, confidence: Confidence) {
    if (!sessionId || !question) return;
    setLogging(true);

    let questionId = question.id;
    if (question.isAiGenerated && question.id.startsWith("tmp_")) {
      questionId = await persistAiQuestion(question);
    }

    await fetch(`/api/sessions/${sessionId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, isCorrect, confidence }),
    });
    setLogging(false);

    if (index + 1 >= questions.length) {
      router.push(`/courses/${courseId}/session/results?sessionId=${sessionId}`);
      return;
    }
    setIndex(index + 1);
  }

  async function handleAiCheck() {
    if (!writtenAnswer.trim()) {
      setAiCheckError("Type your answer first");
      return;
    }
    setAiCheckError(null);
    setAiChecking(true);
    const outcomeName = question?.outcomes?.[0]?.name ?? "";
    const res = await fetch("/api/sessions/check-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        question: question?.content,
        correctAnswer: question?.answer ?? null,
        userAnswer: writtenAnswer,
        outcomeName,
      }),
    });
    const data = await res.json();
    setAiVerdict(data);
    setAiChecking(false);
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "#8FAF76" }}>
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <p className="text-white font-semibold">{loadingMsg}</p>
      </div>
    );
  }

  if (loadError || !question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ backgroundColor: "#8FAF76" }}>
        <p className="text-white font-bold text-center">
          {loadError ?? "No questions found for the selected topics — add some questions first or try AI Generated mode."}
        </p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 rounded-full text-sm font-bold text-gray-800"
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

      {noNotesBanner && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs font-medium text-yellow-900" style={{ backgroundColor: "#fef9c3", borderBottom: "1px solid #fde047" }}>
          <span>✨ Questions generated from your learning outcomes — upload lecture notes for more targeted practice.</span>
          <button
            onClick={() => setNoNotesBanner(false)}
            className="shrink-0 text-yellow-700 hover:text-yellow-900 font-bold leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl p-4 rounded-3xl shadow-xl" style={{ backgroundColor: "#7a9a63" }}>
          <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ backgroundColor: "#FEFEE8" }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold text-gray-700" style={{ border: "1.5px solid #d1d5db" }}>
                  Question {index + 1}
                </span>
                {question.isAiGenerated && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold text-gray-800" style={{ backgroundColor: "#F5C842" }}>
                    ✨ AI
                  </span>
                )}
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold text-gray-700" style={{ border: "1.5px solid #d1d5db" }}>
                {index + 1}/{questions.length}
              </span>
            </div>

            <p className="text-base font-semibold text-gray-800">{question.content}</p>

            {/* ── WRITTEN: Phase 0 — answer input ── */}
            {question.type === "WRITTEN" && !aiChecking && !aiVerdict && !manualMode && userMark === null && (
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
                {aiCheckError && <p className="text-xs text-red-500">{aiCheckError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={handleAiCheck}
                    disabled={!writtenAnswer.trim()}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-gray-800 transition-opacity"
                    style={{ backgroundColor: "#F5C842", opacity: writtenAnswer.trim() ? 1 : 0.5, cursor: writtenAnswer.trim() ? "pointer" : "not-allowed" }}
                  >
                    Check with AI ✨
                  </button>
                  <button
                    onClick={() => setManualMode(true)}
                    disabled={!writtenAnswer.trim()}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-gray-600 transition-opacity"
                    style={{ backgroundColor: "#e5e7eb", opacity: writtenAnswer.trim() ? 1 : 0.5, cursor: writtenAnswer.trim() ? "pointer" : "not-allowed" }}
                  >
                    I&apos;ll mark it myself
                  </button>
                </div>
              </>
            )}

            {/* ── WRITTEN: Manual mode — reveal answer + mark buttons ── */}
            {question.type === "WRITTEN" && manualMode && userMark === null && (
              <>
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-1">CORRECT ANSWER</p>
                  {question.answer ? (
                    <p className="text-sm text-gray-800">{question.answer}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No answer recorded — mark yourself based on your own judgement.</p>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-600 text-center">How did you do?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setUserMark(false)}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-80"
                    style={{ backgroundColor: "#FF6B6B" }}
                  >
                    Incorrect
                  </button>
                  <button
                    onClick={() => setUserMark(true)}
                    className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-80"
                    style={{ backgroundColor: "#5CB85C" }}
                  >
                    Correct
                  </button>
                </div>
              </>
            )}

            {/* ── WRITTEN: Phase 1 — spinner ── */}
            {question.type === "WRITTEN" && aiChecking && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600 font-medium">✨ Checking your answer…</p>
              </div>
            )}

            {/* ── WRITTEN: Phase 2 — AI verdict ── */}
            {question.type === "WRITTEN" && aiVerdict && userMark === null && (() => {
              const borderColor = aiVerdict.result === "correct" ? "#86efac" : aiVerdict.result === "partial" ? "#fde047" : "#fca5a5";
              const bgColor = aiVerdict.result === "correct" ? "#f0fdf4" : aiVerdict.result === "partial" ? "#fefce8" : "#fff1f2";
              const textColor = aiVerdict.result === "correct" ? "#166534" : aiVerdict.result === "partial" ? "#854d0e" : "#991b1b";
              const icon = aiVerdict.result === "correct" ? "✅" : aiVerdict.result === "partial" ? "🟡" : "❌";
              const label = aiVerdict.result === "correct" ? "Looks correct!" : aiVerdict.result === "partial" ? "Partially correct" : "Incorrect";
              return (
                <>
                  <div className="p-4 rounded-2xl border-2" style={{ borderColor, backgroundColor: bgColor }}>
                    <p className="text-xs font-bold mb-2" style={{ color: textColor }}>{icon} {label}</p>
                    {!question.answer && (
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">AI Explanation:</p>
                    )}
                    <p className="text-sm text-gray-700">{aiVerdict.explanation}</p>
                    {question.answer && (
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid #e5e7eb" }}>
                        <p className="text-xs font-bold text-gray-500 mb-1">MODEL ANSWER:</p>
                        <p className="text-sm text-gray-700">{question.answer}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-600 text-center">Confirm your mark:</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setUserMark(false)}
                      className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-90 transition-all"
                      style={{ backgroundColor: "#FF6B6B", outline: !aiVerdict.suggestedMark ? "2px solid #374151" : "none", outlineOffset: "2px" }}
                    >
                      ✗ Mark Incorrect
                    </button>
                    <button
                      onClick={() => setUserMark(true)}
                      className="flex-1 py-3 rounded-full text-sm font-bold text-white hover:opacity-90 transition-all"
                      style={{ backgroundColor: "#5CB85C", outline: aiVerdict.suggestedMark ? "2px solid #374151" : "none", outlineOffset: "2px" }}
                    >
                      ✓ Mark Correct
                    </button>
                  </div>
                </>
              );
            })()}

            {/* ── WRITTEN: Phase 3 — confidence after mark confirmed ── */}
            {question.type === "WRITTEN" && userMark !== null && (() => {
              const mark = userMark;
              return (
                <>
                  <div className={`px-4 py-2 rounded-2xl text-sm font-bold text-center ${mark ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    Marked as {mark ? "Correct ✓" : "Incorrect ✗"}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 font-medium text-center">CONFIDENCE LEVEL</label>
                    <div className="flex gap-3">
                      {(["guessed", "unsure", "confident"] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => { setWrittenConfidence(level); logAttempt(mark, level); }}
                          disabled={logging || writtenConfidence !== null}
                          className="flex-1 py-2 rounded-full text-sm font-bold text-white capitalize transition-all disabled:opacity-50"
                          style={{ backgroundColor: confidenceColors[level] }}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

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
                        {autoCorrect ? "Correct!" : `Incorrect — correct: ${options.filter(o => correctIds.has(o.id)).map(o => o.text).join(", ")}`}
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
                            borderColor: checked ? (blankResults[i] ? "#86efac" : "#fca5a5") : "#d1d5db",
                            backgroundColor: checked ? (blankResults[i] ? "#dcfce7" : "#fee2e2") : "white",
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
