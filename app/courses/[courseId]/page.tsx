"use client";

import Link from "next/link";
import { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

type Outcome = {
  id: string;
  name: string;
  description: string | null;
  mastery: number;
};

type TopicWithOutcomes = {
  id: string;
  name: string;
  outcomes: Outcome[];
};

type CourseData = {
  id: string;
  name: string;
  code: string | null;
  isArchived: boolean;
  courseMastery: number;
  topics: TopicWithOutcomes[];
};

function PlaceholderChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 text-sm text-center px-4">
      {label}
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: Outcome }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#f5f3e0] transition-colors">
      <p className="text-xs text-gray-700 flex-1">{outcome.name}</p>
      <span className="text-xs font-semibold text-gray-500 w-9 text-right shrink-0">
        {outcome.mastery}%
      </span>
      <div className="w-28 h-1.5 rounded-full bg-gray-200 shrink-0">
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${outcome.mastery}%`,
            backgroundColor:
              outcome.mastery < 50 ? "#FF6B6B" : outcome.mastery < 70 ? "#F5C842" : "#5CB85C",
          }}
        />
      </div>
    </div>
  );
}

function TopicAccordionCard({
  topic,
  index,
  isOpen,
  onToggle,
  onAddOutcome,
}: {
  topic: TopicWithOutcomes;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onAddOutcome: (topicId: string, name: string) => Promise<void>;
}) {
  const [addingOutcome, setAddingOutcome] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingOutcome) inputRef.current?.focus();
  }, [addingOutcome]);

  function openForm(e: React.MouseEvent) {
    e.stopPropagation();
    setAddingOutcome(true);
    if (!isOpen) onToggle();
  }

  function cancelForm() {
    setAddingOutcome(false);
    setDraftName("");
  }

  async function confirmAdd() {
    if (!draftName.trim()) return;
    setSaving(true);
    await onAddOutcome(topic.id, draftName.trim());
    setSaving(false);
    cancelForm();
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #e5e3d0" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: "#ede9cc" }}>
        <button
          onClick={onToggle}
          className="flex items-center gap-2.5 flex-1 text-left group min-w-0"
        >
          <svg
            width="11" height="11" viewBox="0 0 12 12" fill="none"
            className="shrink-0 text-gray-500 transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-bold text-gray-800 group-hover:text-black transition-colors">
            Unit {index + 1}: {topic.name}
          </span>
          <span className="text-xs text-gray-400 shrink-0 ml-1">
            {topic.outcomes.length} outcome{topic.outcomes.length !== 1 ? "s" : ""}
          </span>
        </button>
        <button
          onClick={openForm}
          className="text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg transition-colors"
          style={{ color: "#6b6b50", backgroundColor: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e0ddb8")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          + Add Outcome
        </button>
      </div>

      {isOpen && (
        <div style={{ backgroundColor: "#FEFEE8" }}>
          {topic.outcomes.length === 0 && !addingOutcome && (
            <p className="px-5 py-3 text-xs text-gray-400 italic">No outcomes yet</p>
          )}
          {topic.outcomes.map((lo, i) => (
            <div key={lo.id} style={{ borderTop: i === 0 ? "none" : "1px solid #ede9cc" }}>
              <OutcomeRow outcome={lo} />
            </div>
          ))}
          {addingOutcome && (
            <div
              className="flex items-center gap-2 px-5 py-2.5"
              style={{
                borderTop: topic.outcomes.length > 0 ? "1px solid #ede9cc" : "none",
                backgroundColor: "#f5f3e0",
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAdd();
                  if (e.key === "Escape") cancelForm();
                }}
                placeholder="Outcome name…"
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-yellow-300"
                style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
                disabled={saving}
              />
              <button
                onClick={confirmAdd}
                disabled={saving || !draftName.trim()}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-gray-800 hover:opacity-80 transition-opacity shrink-0 disabled:opacity-50"
                style={{ backgroundColor: "#F5C842" }}
              >
                {saving ? "Saving…" : "Add"}
              </button>
              <button
                onClick={cancelForm}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1 shrink-0"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [addingTopic, setAddingTopic] = useState(false);
  const [draftTopicName, setDraftTopicName] = useState("");
  const [savingTopic, setSavingTopic] = useState(false);
  const topicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingTopic) topicInputRef.current?.focus();
  }, [addingTopic]);

  const fetchCourse = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data: CourseData = await res.json();
    setCourse(data);
    if (data.topics.length > 0) {
      setOpenTopics(new Set([data.topics[0].id]));
    }
    setLoading(false);
  }, [courseId, router]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  function toggleTopic(id: string) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddTopic() {
    if (!draftTopicName.trim()) return;
    setSavingTopic(true);
    const res = await fetch(`/api/courses/${courseId}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draftTopicName.trim() }),
    });
    if (res.ok) {
      setDraftTopicName("");
      setAddingTopic(false);
      await fetchCourse();
    }
    setSavingTopic(false);
  }

  async function handleAddOutcome(topicId: string, name: string) {
    await fetch(`/api/courses/${courseId}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, topicId }),
    });
    await fetchCourse();
  }

  async function confirmArchive() {
    await fetch(`/api/courses/${courseId}`, { method: "PATCH" });
    router.push("/dashboard");
  }

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

  if (!course) return null;

  const allOutcomes = course.topics.flatMap((t) => t.outcomes);
  const worstOutcomes = [...allOutcomes].sort((a, b) => a.mastery - b.mastery).slice(0, 10);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          course.code ? (
            <span
              className="px-4 py-1 rounded-full text-xs font-bold text-gray-700"
              style={{ backgroundColor: "#D6EEF8" }}
            >
              {course.code}
            </span>
          ) : undefined
        }
      />

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/courses/${courseId}/session/setup`}
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#F5C842" }}
          >
            Start Study Session
          </Link>
          <Link
            href={`/courses/${courseId}/questions`}
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            View Questions
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Course Mastery</h2>
            <p className="text-xs text-gray-500">Based on study sessions and learning outcomes</p>
            <div className="text-4xl font-black text-gray-800">{course.courseMastery}%</div>
            <div className="w-full h-3 rounded-full bg-gray-200">
              <div
                className="h-3 rounded-full"
                style={{ width: `${course.courseMastery}%`, backgroundColor: "#5CB85C" }}
              />
            </div>
            <PlaceholderChart label="Mastery over time chart — coming soon" />
          </div>

          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Top 10 Outcomes to Practice</h2>
            <p className="text-xs text-gray-500">Ranked worst to best — focus here first</p>
            {worstOutcomes.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Complete a study session to see recommendations.</p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
                {worstOutcomes.map((lo, i) => (
                  <div key={lo.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-700">{lo.name}</p>
                      <div className="w-full h-1.5 rounded-full bg-gray-200 mt-1">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${lo.mastery}%`,
                            backgroundColor: lo.mastery < 50 ? "#FF6B6B" : lo.mastery < 70 ? "#F5C842" : "#5CB85C",
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{lo.mastery}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Uploaded Documents</h2>
            <p className="text-xs text-gray-500">Learning outcomes, practice questions, and assessments retrieved</p>
            <p className="text-xs text-gray-400 italic">Document upload coming soon.</p>
          </div>

          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Upload Document</h2>
            <p className="text-xs text-gray-500">Clarify what you are uploading and its purpose</p>
            <select className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 bg-white">
              <option value="">Select upload purpose…</option>
              <option value="lecture">Lecture slides / notes</option>
              <option value="assignment">Assignment specification</option>
              <option value="quiz">Quiz / exam paper</option>
              <option value="grades">Assessment grades</option>
            </select>
            <div className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 text-sm cursor-pointer hover:border-gray-400 transition-colors">
              <span className="text-2xl mb-1">📄</span>
              <span>Click to upload or drag & drop</span>
              <span className="text-xs mt-1">PDF, DOCX, PNG up to 20MB</span>
            </div>
            <button
              className="w-full py-2 rounded-full text-sm font-bold text-gray-800 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#F5C842" }}
            >
              Upload
            </button>
          </div>
        </div>

        <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Learning Outcomes</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {allOutcomes.length} outcome{allOutcomes.length !== 1 ? "s" : ""}
                {course.topics.length > 0
                  ? ` across ${course.topics.length} topic${course.topics.length !== 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
            <button
              onClick={() => setAddingTopic(true)}
              className="px-3 py-1.5 rounded-full text-xs font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#F5C842" }}
            >
              + Add Topic
            </button>
          </div>

          {addingTopic && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{ backgroundColor: "#f5f3e0", border: "1px solid #e5e3d0" }}
            >
              <input
                ref={topicInputRef}
                type="text"
                value={draftTopicName}
                onChange={(e) => setDraftTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTopic();
                  if (e.key === "Escape") { setAddingTopic(false); setDraftTopicName(""); }
                }}
                placeholder="Topic name…"
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-yellow-300"
                style={{ borderColor: "#d6d0a8", backgroundColor: "white" }}
                disabled={savingTopic}
              />
              <button
                onClick={handleAddTopic}
                disabled={savingTopic || !draftTopicName.trim()}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-gray-800 hover:opacity-80 disabled:opacity-50 shrink-0"
                style={{ backgroundColor: "#F5C842" }}
              >
                {savingTopic ? "Saving…" : "Add"}
              </button>
              <button
                onClick={() => { setAddingTopic(false); setDraftTopicName(""); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-1 shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          {course.topics.length > 0 && (
            <div className="flex flex-col gap-3">
              {course.topics.map((topic, idx) => (
                <TopicAccordionCard
                  key={topic.id}
                  topic={topic}
                  index={idx}
                  isOpen={openTopics.has(topic.id)}
                  onToggle={() => toggleTopic(topic.id)}
                  onAddOutcome={handleAddOutcome}
                />
              ))}
            </div>
          )}

          {course.topics.length === 0 && allOutcomes.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No outcomes yet — add a topic to get started.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          {!showArchiveConfirm ? (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              style={{ backgroundColor: "#e5e7eb" }}
            >
              Archive Course
            </button>
          ) : (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow" style={{ backgroundColor: "#FEFEE8" }}>
              <p className="text-sm text-gray-700">Are you sure you want to archive this course?</p>
              <button
                onClick={confirmArchive}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-gray-800 hover:opacity-80"
                style={{ backgroundColor: "#F5C842" }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-gray-500 hover:text-gray-700"
                style={{ backgroundColor: "#e5e7eb" }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
