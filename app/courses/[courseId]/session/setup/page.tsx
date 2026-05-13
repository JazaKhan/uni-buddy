"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

type Outcome = { id: string; name: string };
type Topic = { id: string; name: string; questionCount: number; outcomes: Outcome[] };

type Mode = "topic" | "outcome";
type DocStatus = "loading" | "none" | "no_notes" | "has_notes";

export default function SessionSetupPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [courseCode, setCourseCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("topic");
  const [aiMode, setAiMode] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [customCount, setCustomCount] = useState(false);
  const [docStatus, setDocStatus] = useState<DocStatus>("loading");

  // Topic mode state
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  // Outcome mode state
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<string>>(new Set());
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${courseId}`).then((r) => r.json()),
      fetch(`/api/courses/${courseId}/documents`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([courseData, docs]) => {
        setTopics(courseData.topics ?? []);
        setCourseCode(courseData.code ?? null);
        if (courseData.topics?.length > 0) setOpenTopics(new Set([courseData.topics[0].id]));
        setLoading(false);

        const allDocs: { purpose: string }[] = Array.isArray(docs) ? docs : [];
        if (allDocs.length === 0) {
          setDocStatus("none");
        } else if (allDocs.some((d) => d.purpose === "lecture" || d.purpose === "outcomes")) {
          setDocStatus("has_notes");
        } else {
          setDocStatus("no_notes");
        }
      })
      .catch(() => router.push("/dashboard"));
  }, [courseId, router]);

  // Topic mode helpers
  const allTopicsSelected = topics.length > 0 && selectedTopics.size === topics.length;
  function toggleTopic(id: string) {
    setSelectedTopics((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAllTopics() {
    setSelectedTopics(allTopicsSelected ? new Set() : new Set(topics.map((t) => t.id)));
  }

  // Outcome mode helpers
  const allOutcomes = topics.flatMap((t) => t.outcomes);
  const allOutcomesSelected = allOutcomes.length > 0 && selectedOutcomes.size === allOutcomes.length;
  function toggleOutcome(id: string) {
    setSelectedOutcomes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAllOutcomes() {
    setSelectedOutcomes(allOutcomesSelected ? new Set() : new Set(allOutcomes.map((o) => o.id)));
  }
  function toggleOpenTopic(id: string) {
    setOpenTopics((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTopicOutcomes(topic: Topic) {
    const ids = topic.outcomes.map((o) => o.id);
    const allSelected = ids.every((id) => selectedOutcomes.has(id));
    setSelectedOutcomes((prev) => {
      const n = new Set(prev);
      if (allSelected) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  }

  function startSession() {
    const aiParam = aiMode ? `&ai=true&count=${questionCount}` : "";
    if (mode === "topic") {
      router.push(`/courses/${courseId}/session?topics=${Array.from(selectedTopics).join(",")}${aiParam}`);
    } else {
      router.push(`/courses/${courseId}/session?outcomes=${Array.from(selectedOutcomes).join(",")}${aiParam}`);
    }
  }

  const canStart = mode === "topic" ? selectedTopics.size > 0 : selectedOutcomes.size > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
        <NavBar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-white font-semibold">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          courseCode ? (
            <span className="px-4 py-1 rounded-full text-xs font-bold text-gray-700" style={{ backgroundColor: "#D6EEF8" }}>
              {courseCode} — Session Setup
            </span>
          ) : undefined
        }
      />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-black text-white">What do you want to practice today?</h1>
            <p className="text-sm text-white/70 mt-1">Choose how to filter your session.</p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-full self-start" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
            {(["topic", "outcome"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-5 py-2 rounded-full text-xs font-bold transition-all"
                style={{
                  backgroundColor: mode === m ? "#F5C842" : "transparent",
                  color: mode === m ? "#1f2937" : "rgba(255,255,255,0.8)",
                }}
              >
                By {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* ── BY TOPIC MODE ── */}
          {mode === "topic" && (
            <>
              {topics.length > 0 && (
                <button
                  onClick={toggleAllTopics}
                  className="self-start text-xs font-bold text-white/80 hover:text-white underline underline-offset-2"
                >
                  {allTopicsSelected ? "Deselect All" : "Select All"}
                </button>
              )}
              {topics.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {topics.map((topic) => {
                    const isSelected = selectedTopics.has(topic.id);
                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className="flex items-center gap-4 p-4 rounded-2xl shadow-md text-left transition-all"
                        style={{
                          backgroundColor: isSelected ? "#F5C842" : "#FEFEE8",
                          outline: isSelected ? "2px solid #d4a800" : "none",
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: isSelected ? "#d4a800" : "#d1d5db", backgroundColor: isSelected ? "#d4a800" : "white" }}
                        >
                          {isSelected && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">{topic.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {topic.questionCount} question{topic.questionCount !== 1 ? "s" : ""} · {topic.outcomes.length} outcome{topic.outcomes.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl shadow-md text-center" style={{ backgroundColor: "#FEFEE8" }}>
                  <p className="text-sm text-gray-500">No topics found.</p>
                  <p className="text-xs text-gray-400 mt-1">Add topics from the Course page first.</p>
                </div>
              )}
            </>
          )}

          {/* ── BY OUTCOME MODE ── */}
          {mode === "outcome" && (
            <>
              {allOutcomes.length > 0 && (
                <button
                  onClick={toggleAllOutcomes}
                  className="self-start text-xs font-bold text-white/80 hover:text-white underline underline-offset-2"
                >
                  {allOutcomesSelected ? "Deselect All" : "Select All"}
                </button>
              )}
              {topics.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {topics.map((topic) => {
                    const isOpen = openTopics.has(topic.id);
                    const topicOutcomeIds = topic.outcomes.map((o) => o.id);
                    const allTopicSelected = topicOutcomeIds.length > 0 && topicOutcomeIds.every((id) => selectedOutcomes.has(id));
                    const someTopicSelected = topicOutcomeIds.some((id) => selectedOutcomes.has(id));

                    return (
                      <div key={topic.id} className="rounded-2xl overflow-hidden shadow-md" style={{ border: "1px solid #e5e3d0" }}>
                        {/* Topic header */}
                        <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: someTopicSelected ? "#F5C842" : "#ede9cc" }}>
                          <button onClick={() => toggleOpenTopic(topic.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                            <svg
                              width="11" height="11" viewBox="0 0 12 12" fill="none"
                              className="shrink-0 text-gray-600 transition-transform duration-200"
                              style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                            >
                              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-xs font-bold text-gray-800">{topic.name}</span>
                            <span className="text-xs text-gray-500 ml-1">
                              {topicOutcomeIds.filter((id) => selectedOutcomes.has(id)).length}/{topic.outcomes.length} selected
                            </span>
                          </button>
                          <button
                            onClick={() => toggleTopicOutcomes(topic)}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 transition-colors"
                            style={{ backgroundColor: allTopicSelected ? "#d4a800" : "#e0ddb8", color: "#374151" }}
                          >
                            {allTopicSelected ? "Deselect All" : "Select All"}
                          </button>
                        </div>

                        {/* Outcomes */}
                        {isOpen && (
                          <div style={{ backgroundColor: "#FEFEE8" }}>
                            {topic.outcomes.length === 0 ? (
                              <p className="px-5 py-3 text-xs text-gray-400 italic">No outcomes in this topic.</p>
                            ) : (
                              topic.outcomes.map((outcome, i) => {
                                const isSelected = selectedOutcomes.has(outcome.id);
                                return (
                                  <button
                                    key={outcome.id}
                                    onClick={() => toggleOutcome(outcome.id)}
                                    className="w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-[#f5f3e0]"
                                    style={{ borderTop: i === 0 ? "none" : "1px solid #ede9cc" }}
                                  >
                                    <div
                                      className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                                      style={{ borderColor: isSelected ? "#d4a800" : "#d1d5db", backgroundColor: isSelected ? "#d4a800" : "white" }}
                                    >
                                      {isSelected && (
                                        <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-700 flex-1">{outcome.name}</p>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl shadow-md text-center" style={{ backgroundColor: "#FEFEE8" }}>
                  <p className="text-sm text-gray-500">No outcomes found.</p>
                  <p className="text-xs text-gray-400 mt-1">Add topics and outcomes from the Course page first.</p>
                </div>
              )}
            </>
          )}

          {/* Question Source toggle */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-white">Question Source:</span>
              <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                {[{ label: "My Questions", value: false }, { label: "✨ AI Generated", value: true }].map(({ label, value }) => (
                  <button
                    key={String(value)}
                    onClick={() => setAiMode(value)}
                    className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{
                      backgroundColor: aiMode === value ? "#F5C842" : "transparent",
                      color: aiMode === value ? "#1f2937" : "rgba(255,255,255,0.8)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {aiMode && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-white/80">Number of questions:</span>
                  <div className="flex gap-2 flex-wrap">
                    {[5, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => { setQuestionCount(n); setCustomCount(false); }}
                        className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                        style={{
                          backgroundColor: !customCount && questionCount === n ? "#F5C842" : "rgba(0,0,0,0.15)",
                          color: !customCount && questionCount === n ? "#1f2937" : "rgba(255,255,255,0.8)",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => setCustomCount(true)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={{
                        backgroundColor: customCount ? "#F5C842" : "rgba(0,0,0,0.15)",
                        color: customCount ? "#1f2937" : "rgba(255,255,255,0.8)",
                      }}
                    >
                      Custom
                    </button>
                    {customCount && (
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 px-2 py-1 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-yellow-300"
                        style={{ backgroundColor: "#FEFEE8" }}
                      />
                    )}
                  </div>
                </div>
                {docStatus === "has_notes" ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold text-green-800" style={{ backgroundColor: "#dcfce7", border: "1px solid #86efac" }}>
                    ✓ Using your uploaded course notes to generate questions.
                  </div>
                ) : docStatus === "none" || docStatus === "no_notes" ? (
                  <div className="px-4 py-3 rounded-2xl text-xs text-yellow-900" style={{ backgroundColor: "#fef9c3", border: "1px solid #fde047" }}>
                    <p className="font-bold mb-0.5">⚠️ No course notes uploaded yet.</p>
                    <p className="font-normal opacity-80">AI can still generate questions from your learning outcomes, but they'll be more generic. Upload lecture slides for better questions.</p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="px-5 py-3 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#FEFEE8" }}
            >
              ← Back
            </button>
            <button
              onClick={startSession}
              disabled={!canStart}
              className="flex-1 py-3 rounded-full text-sm font-bold text-gray-800 shadow transition-opacity"
              style={{ backgroundColor: "#F5C842", opacity: canStart ? 1 : 0.45, cursor: canStart ? "pointer" : "not-allowed" }}
            >
              Start Session →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
