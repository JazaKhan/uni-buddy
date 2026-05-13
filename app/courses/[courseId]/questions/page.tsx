"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

type Topic = { id: string; name: string };
type Outcome = { id: string; name: string };
type OutcomeOption = { id: string; name: string; topicName: string };
type QuestionType = "WRITTEN" | "MULTIPLE_CHOICE" | "FILL_IN_BLANK";
type MCOption = { id: string; text: string; isCorrect: boolean };

type Question = {
  id: string;
  content: string;
  answer: string | null;
  type: QuestionType;
  mastery: number;
  isAiGenerated: boolean;
  topics: Topic[];
  outcomes: Outcome[];
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeOptions(): MCOption[] {
  return [0, 1, 2, 3].map(() => ({ id: genId(), text: "", isCorrect: false }));
}

export default function QuestionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [aiFilter, setAiFilter] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);

  // Modal state (shared between add and edit)
  const [showModal, setShowModal] = useState(false);
  const [draftType, setDraftType] = useState<QuestionType>("WRITTEN");
  const [draftContent, setDraftContent] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [draftTopicIds, setDraftTopicIds] = useState<string[]>([]);
  const [draftOutcomeIds, setDraftOutcomeIds] = useState<string[]>([]);
  const [draftOptions, setDraftOptions] = useState<MCOption[]>(makeOptions);
  const [draftBlanks, setDraftBlanks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Keep blank inputs in sync with ___ count
  useEffect(() => {
    if (draftType !== "FILL_IN_BLANK") return;
    const count = Math.max(0, draftContent.split("___").length - 1);
    setDraftBlanks((prev) => {
      if (prev.length === count) return prev;
      if (prev.length < count) return [...prev, ...Array(count - prev.length).fill("")];
      return prev.slice(0, count);
    });
  }, [draftContent, draftType]);

  const fetchData = useCallback(async () => {
    const [questionsRes, courseRes] = await Promise.all([
      fetch(`/api/courses/${courseId}/questions`),
      fetch(`/api/courses/${courseId}`),
    ]);
    if (!questionsRes.ok || !courseRes.ok) { router.push("/dashboard"); return; }
    const questionsData: Question[] = await questionsRes.json();
    const courseData = await courseRes.json();
    setQuestions(questionsData);
    setTopics(courseData.topics as Topic[]);
    const flat: OutcomeOption[] = courseData.topics.flatMap((t: any) =>
      t.outcomes.map((o: any) => ({ id: o.id, name: o.name, topicName: t.name }))
    );
    setOutcomes(flat);
    setLoading(false);
  }, [courseId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function resetModal() {
    setDraftType("WRITTEN");
    setDraftContent("");
    setDraftAnswer("");
    setDraftTopicIds([]);
    setDraftOutcomeIds([]);
    setDraftOptions(makeOptions());
    setDraftBlanks([]);
    setEditingQuestion(null);
    setSaveError(null);
  }

  function openAddModal() {
    resetModal();
    setShowModal(true);
  }

  function openEditModal(q: Question) {
    setEditingQuestion(q);
    setDraftType(q.type);
    setDraftContent(q.content);
    setDraftAnswer(q.answer ?? "");
    setDraftTopicIds(q.topics.map((t) => t.id));
    setDraftOutcomeIds(q.outcomes.map((o) => o.id));
    if (q.type === "MULTIPLE_CHOICE" && q.options) {
      // Cast stored options; preserve their ids so order is stable
      setDraftOptions((q.options as unknown as MCOption[]).map((o) => ({ ...o })));
    } else {
      setDraftOptions(makeOptions());
    }
    // FIB blanks: useEffect will sync count from content; pre-fill values here
    setDraftBlanks(q.type === "FILL_IN_BLANK" && q.blanks ? (q.blanks as unknown as string[]) : []);
    setShowModal(true);
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      content: draftContent.trim(),
      topicIds: draftTopicIds,
      outcomeIds: draftOutcomeIds,
      type: draftType,
    };
    if (draftType === "WRITTEN") {
      body.answer = draftAnswer.trim() || null;
    } else if (draftType === "MULTIPLE_CHOICE") {
      const filled = draftOptions.filter((o) => o.text.trim());
      body.options = filled.map((o) => ({ id: o.id, text: o.text.trim(), isCorrect: o.isCorrect }));
      const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
      const correctLabels = filled.map((o, i) => (o.isCorrect ? labels[i] : null)).filter(Boolean);
      body.answer = `Correct: ${correctLabels.join(", ")}`;
    } else if (draftType === "FILL_IN_BLANK") {
      body.blanks = draftBlanks.map((b) => b.trim());
      let i = 0;
      body.answer = draftContent.replace(/___/g, () => `[${draftBlanks[i++]?.trim() ?? ""}]`);
    }
    return body;
  }

  async function handleSaveQuestion() {
    setSaving(true);
    setSaveError(null);
    try {
      const body = buildBody();
      const url = editingQuestion
        ? `/api/courses/${courseId}/questions/${editingQuestion.id}`
        : `/api/courses/${courseId}/questions`;
      const res = await fetch(url, {
        method: editingQuestion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowModal(false);
        resetModal();
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? `Server error (${res.status})`);
      }
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuestion(q: Question) {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    setDeletingQuestionId(q.id);
    try {
      const res = await fetch(`/api/courses/${courseId}/questions/${q.id}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions((prev) => prev.filter((item) => item.id !== q.id));
      }
    } finally {
      setDeletingQuestionId(null);
    }
  }

  function canSave() {
    if (!draftContent.trim()) return false;
    if (draftType === "MULTIPLE_CHOICE") {
      const filled = draftOptions.filter((o) => o.text.trim());
      return filled.length >= 2 && filled.some((o) => o.isCorrect);
    }
    if (draftType === "FILL_IN_BLANK") {
      const count = draftContent.split("___").length - 1;
      return count > 0 && draftBlanks.length === count && draftBlanks.every((b) => b.trim());
    }
    return true;
  }

  function toggleDraftTopic(id: string) {
    setDraftTopicIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  function toggleDraftOutcome(id: string) {
    setDraftOutcomeIds((prev) => prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]);
  }

  function updateOption(idx: number, patch: Partial<MCOption>) {
    setDraftOptions((prev) => prev.map((o, i) => i === idx ? { ...o, ...patch } : o));
  }

  function removeOption(idx: number) {
    setDraftOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addOption() {
    if (draftOptions.length >= 8) return;
    setDraftOptions((prev) => [...prev, { id: genId(), text: "", isCorrect: false }]);
  }

  let filtered = questions;
  if (activeTopic) filtered = filtered.filter((q) => q.topics.some((t) => t.id === activeTopic));
  if (aiFilter) filtered = filtered.filter((q) => q.isAiGenerated);
  filtered = filtered.filter((q) => q.content.toLowerCase().includes(search.toLowerCase()));

  const fibBlankCount = draftType === "FILL_IN_BLANK" ? Math.max(0, draftContent.split("___").length - 1) : 0;
  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#6B9EA0" }}>
        <NavBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-white font-semibold">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#6B9EA0" }}>
      <NavBar
        centerContent={
          <span className="px-4 py-1 rounded-full text-xs font-bold text-gray-700" style={{ backgroundColor: "#D6EEF8" }}>
            Questions
          </span>
        }
      />

      <main className="flex-1 p-6 flex flex-col gap-5 max-w-3xl mx-auto w-full">
        <div className="relative">
          <input
            type="text"
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-5 py-3 rounded-full text-sm outline-none shadow-md"
            style={{ backgroundColor: "#FEFEE8" }}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setActiveTopic(null); setAiFilter(false); }}
            className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{ backgroundColor: activeTopic === null && !aiFilter ? "#374151" : "#FEFEE8", color: activeTopic === null && !aiFilter ? "white" : "#374151" }}
          >
            All
          </button>
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => { setActiveTopic(activeTopic === topic.id ? null : topic.id); setAiFilter(false); }}
              className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{ backgroundColor: activeTopic === topic.id ? "#374151" : "#FEFEE8", color: activeTopic === topic.id ? "white" : "#374151" }}
            >
              {topic.name}
            </button>
          ))}
          {questions.some((q) => q.isAiGenerated) && (
            <button
              onClick={() => { setAiFilter((prev) => !prev); setActiveTopic(null); }}
              className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{ backgroundColor: aiFilter ? "#F5C842" : "#FEFEE8", color: "#374151" }}
            >
              ✨ AI
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {filtered.map((q) => {
            const isDeleting = deletingQuestionId === q.id;
            return (
              <div
                key={q.id}
                className="flex items-center justify-between px-5 py-3 rounded-full shadow-md transition-all"
                style={{
                  backgroundColor: "#FEFEE8",
                  outline: editMode ? "2px solid #F5C842" : "none",
                  outlineOffset: "1px",
                }}
              >
                <p className="text-sm text-gray-800 flex-1 mr-4 line-clamp-1">{q.content}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {q.isAiGenerated && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F5C842", color: "#374151" }}>✨ AI</span>
                  )}
                  {q.type === "MULTIPLE_CHOICE" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e5e7eb", color: "#374151" }}>MC</span>
                  )}
                  {q.type === "FILL_IN_BLANK" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e5e7eb", color: "#374151" }}>FIB</span>
                  )}

                  {editMode ? (
                    <>
                      <button
                        onClick={() => openEditModal(q)}
                        title="Edit question"
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-yellow-100 transition-colors text-gray-600 hover:text-gray-900"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q)}
                        disabled={isDeleting}
                        title="Delete question"
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-100 transition-colors text-gray-600 hover:text-red-600 disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                        ) : "🗑️"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-1.5 rounded-full bg-gray-200">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${q.mastery}%`, backgroundColor: q.mastery < 50 ? "#FF6B6B" : q.mastery < 70 ? "#F5C842" : "#5CB85C" }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-9 text-right">{q.mastery}%</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-center text-white text-sm py-8">
              {questions.length === 0 ? "No questions yet — add one to get started." : "No questions match your search."}
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-between mt-2">
          <Link
            href={`/courses/${courseId}`}
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            ← Back to Course
          </Link>
          <div className="flex gap-2">
            {questions.length > 0 && (
              <button
                onClick={() => setEditMode((prev) => !prev)}
                className="px-5 py-2 rounded-full text-sm font-bold text-gray-700 shadow hover:opacity-80 transition-opacity"
                style={{ backgroundColor: editMode ? "#d1d5db" : "#e5e7eb" }}
              >
                {editMode ? "Done Editing" : "Edit Questions"}
              </button>
            )}
            <button
              onClick={openAddModal}
              className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#F5C842" }}
            >
              + Add Question
            </button>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-lg rounded-3xl shadow-xl flex flex-col max-h-[90vh]" style={{ backgroundColor: "#FEFEE8" }}>
            <div className="p-6 pb-4 shrink-0">
              <h2 className="text-sm font-bold text-gray-800 mb-3">
                {editingQuestion ? "Edit Question" : "Add Question"}
              </h2>

              {/* Type selector */}
              <div className="flex gap-1.5 p-1 rounded-full self-start" style={{ backgroundColor: "#e5e3d0" }}>
                {(["WRITTEN", "MULTIPLE_CHOICE", "FILL_IN_BLANK"] as const).map((t) => {
                  const label = t === "WRITTEN" ? "Written" : t === "MULTIPLE_CHOICE" ? "Multiple Choice" : "Fill in the Blank";
                  return (
                    <button
                      key={t}
                      onClick={() => setDraftType(t)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={{ backgroundColor: draftType === t ? "#F5C842" : "transparent", color: draftType === t ? "#1f2937" : "#6b7280" }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-4 pb-2">
              {/* Question content */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">
                  {draftType === "FILL_IN_BLANK" ? 'Question * — use ___ (three underscores) for each blank' : 'Question *'}
                </label>
                <textarea
                  rows={3}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder={draftType === "FILL_IN_BLANK" ? "e.g. The capital of France is ___." : "Enter the question…"}
                  className="w-full px-4 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                  style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
                />
                {draftType === "FILL_IN_BLANK" && (
                  <p className="text-xs text-gray-400">
                    {fibBlankCount === 0 ? "No blanks detected yet." : `${fibBlankCount} blank${fibBlankCount !== 1 ? "s" : ""} detected.`}
                  </p>
                )}
              </div>

              {/* Written: answer textarea */}
              {draftType === "WRITTEN" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Answer (optional)</label>
                  <textarea
                    rows={2}
                    value={draftAnswer}
                    onChange={(e) => setDraftAnswer(e.target.value)}
                    placeholder="Leave blank if you don't know it yet"
                    className="w-full px-4 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                    style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
                  />
                </div>
              )}

              {/* Multiple Choice: options */}
              {draftType === "MULTIPLE_CHOICE" && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-600">Options * (check all correct answers)</label>
                  {draftOptions.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{optionLabels[idx]}</span>
                      <input
                        type="checkbox"
                        checked={opt.isCorrect}
                        onChange={(e) => updateOption(idx, { isCorrect: e.target.checked })}
                        className="accent-yellow-400 w-4 h-4 shrink-0"
                        title="Mark as correct"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOption(idx, { text: e.target.value })}
                        placeholder={`Option ${optionLabels[idx]}…`}
                        className="flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-yellow-300"
                        style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
                      />
                      {draftOptions.length > 2 && (
                        <button onClick={() => removeOption(idx)} className="text-red-400 hover:text-red-600 text-sm leading-none shrink-0">×</button>
                      )}
                    </div>
                  ))}
                  {draftOptions.length < 8 && (
                    <button onClick={addOption} className="self-start text-xs font-semibold text-gray-500 hover:text-gray-700 underline underline-offset-2 mt-1">
                      + Add option
                    </button>
                  )}
                </div>
              )}

              {/* Fill in the Blank: blank answers */}
              {draftType === "FILL_IN_BLANK" && fibBlankCount > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-600">Correct answers for each blank *</label>
                  {Array.from({ length: fibBlankCount }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-14 shrink-0">Blank {i + 1}:</span>
                      <input
                        type="text"
                        value={draftBlanks[i] ?? ""}
                        onChange={(e) => setDraftBlanks((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                        placeholder={`Answer for blank ${i + 1}…`}
                        className="flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-yellow-300"
                        style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Tag to topics */}
              {topics.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Tag to topics (optional)</label>
                  <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto pr-1">
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => toggleDraftTopic(t.id)}
                        className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                        style={{ backgroundColor: draftTopicIds.includes(t.id) ? "#374151" : "#e5e3d0", color: draftTopicIds.includes(t.id) ? "white" : "#374151" }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag to outcomes */}
              {outcomes.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Tag to outcomes (optional)</label>
                  <div className="flex gap-2 flex-wrap max-h-48 overflow-y-auto pr-1">
                    {outcomes.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => toggleDraftOutcome(o.id)}
                        className="px-3 py-1 rounded-full text-xs font-bold transition-all flex flex-col items-start"
                        style={{ backgroundColor: draftOutcomeIds.includes(o.id) ? "#374151" : "#e5e3d0", color: draftOutcomeIds.includes(o.id) ? "white" : "#374151" }}
                      >
                        <span>{o.name}</span>
                        <span className="text-[10px] font-normal opacity-60">{o.topicName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 px-6 pt-3 pb-6 shrink-0">
              {saveError && (
                <p className="text-xs text-red-600 font-medium text-center">{saveError}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowModal(false); resetModal(); }}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-700"
                  style={{ backgroundColor: "#e5e7eb" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveQuestion}
                  disabled={saving || !canSave()}
                  className="px-5 py-2 rounded-full text-xs font-bold text-gray-800 hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "#F5C842" }}
                >
                  {saving ? "Saving…" : editingQuestion ? "Save Changes" : "Add Question"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
