"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

type Topic = { id: string; name: string };
type Outcome = { id: string; name: string };

type Question = {
  id: string;
  content: string;
  answer: string | null;
  mastery: number;
  topics: Topic[];
  outcomes: Outcome[];
};

export default function QuestionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  // Add question modal state
  const [showModal, setShowModal] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [draftTopicIds, setDraftTopicIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
    setLoading(false);
  }, [courseId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAddQuestion() {
    if (!draftContent.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/courses/${courseId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: draftContent.trim(),
        answer: draftAnswer.trim() || null,
        topicIds: draftTopicIds,
      }),
    });
    if (res.ok) {
      setDraftContent("");
      setDraftAnswer("");
      setDraftTopicIds([]);
      setShowModal(false);
      await fetchData();
    }
    setSaving(false);
  }

  function toggleDraftTopic(id: string) {
    setDraftTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  let filtered = questions;
  if (activeTopic) {
    filtered = filtered.filter((q) => q.topics.some((t) => t.id === activeTopic));
  }
  filtered = filtered.filter((q) =>
    q.content.toLowerCase().includes(search.toLowerCase())
  );

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
          <span
            className="px-4 py-1 rounded-full text-xs font-bold text-gray-700"
            style={{ backgroundColor: "#D6EEF8" }}
          >
            Questions
          </span>
        }
      />

      <main className="flex-1 p-6 flex flex-col gap-5 max-w-3xl mx-auto w-full">
        {/* Search */}
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

        {/* Topic filter pills */}
        {topics.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTopic(null)}
              className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                backgroundColor: activeTopic === null ? "#374151" : "#FEFEE8",
                color: activeTopic === null ? "white" : "#374151",
              }}
            >
              All
            </button>
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setActiveTopic(activeTopic === topic.id ? null : topic.id)}
                className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  backgroundColor: activeTopic === topic.id ? "#374151" : "#FEFEE8",
                  color: activeTopic === topic.id ? "white" : "#374151",
                }}
              >
                {topic.name}
              </button>
            ))}
          </div>
        )}

        {/* Question list */}
        <div className="flex flex-col gap-3">
          {filtered.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between px-5 py-3 rounded-full shadow-md"
              style={{ backgroundColor: "#FEFEE8" }}
            >
              <p className="text-sm text-gray-800 flex-1 mr-4 line-clamp-1">{q.content}</p>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${q.mastery}%`,
                      backgroundColor:
                        q.mastery < 50 ? "#FF6B6B" : q.mastery < 70 ? "#F5C842" : "#5CB85C",
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-600 w-9 text-right">{q.mastery}%</span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-center text-white text-sm py-8">
              {questions.length === 0 ? "No questions yet — add one to get started." : "No questions match your search."}
            </p>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex gap-3 justify-between mt-2">
          <Link
            href={`/courses/${courseId}`}
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            ← Back to Course
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#F5C842" }}
          >
            + Add Question
          </button>
        </div>
      </main>

      {/* Add Question Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-lg rounded-3xl shadow-xl p-6 flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Add Question</h2>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Question *</label>
              <textarea
                rows={3}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Enter the question…"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Answer (optional)</label>
              <textarea
                rows={2}
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                placeholder="Enter the answer…"
                className="w-full px-4 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
              />
            </div>

            {topics.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Tag to topics (optional)</label>
                <div className="flex gap-2 flex-wrap">
                  {topics.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => toggleDraftTopic(t.id)}
                      className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                      style={{
                        backgroundColor: draftTopicIds.includes(t.id) ? "#374151" : "#e5e3d0",
                        color: draftTopicIds.includes(t.id) ? "white" : "#374151",
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setShowModal(false); setDraftContent(""); setDraftAnswer(""); setDraftTopicIds([]); }}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-700"
                style={{ backgroundColor: "#e5e7eb" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddQuestion}
                disabled={saving || !draftContent.trim()}
                className="px-5 py-2 rounded-full text-xs font-bold text-gray-800 hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "#F5C842" }}
              >
                {saving ? "Saving…" : "Add Question"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
