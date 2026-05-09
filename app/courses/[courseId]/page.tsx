"use client";

import Link from "next/link";
import { use, useState, useRef, useEffect } from "react";
import NavBar from "@/components/NavBar";
import {
  mockCourses,
  mockDocuments,
  getTopicsForCourse,
  getOutcomesForCourse,
  type Topic,
  type Outcome,
} from "@/lib/mockData";

// ── Sub-components ────────────────────────────────────────────────────────────

function PlaceholderChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 text-sm text-center px-4">
      {label}
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: Outcome }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#f5f3e0] transition-colors cursor-pointer">
      <p className="text-xs text-gray-700 flex-1">{outcome.text}</p>
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
  outcomes,
  index,
  isOpen,
  onToggle,
}: {
  topic: Topic;
  outcomes: Outcome[];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [addingOutcome, setAddingOutcome] = useState(false);
  const [draftName, setDraftName] = useState("");
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

  function confirmAdd() {
    // persistence not wired yet — just close the form
    cancelForm();
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ border: "1px solid #e5e3d0" }}
    >
      {/* ── Topic header row ── */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: "#ede9cc" }}
      >
        {/* Chevron + title — clickable for toggle */}
        <button
          onClick={onToggle}
          className="flex items-center gap-2.5 flex-1 text-left group min-w-0"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0 text-gray-500 transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path
              d="M4 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-bold text-gray-800 group-hover:text-black transition-colors">
            Unit {index + 1}: {topic.name}
          </span>
          <span className="text-xs text-gray-400 shrink-0 ml-1">
            {outcomes.length} outcome{outcomes.length !== 1 ? "s" : ""}
          </span>
        </button>

        {/* + Add Outcome — always visible, never triggers toggle */}
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

      {/* ── Outcomes body — only when open ── */}
      {isOpen && (
        <div style={{ backgroundColor: "#FEFEE8" }}>
          {outcomes.length === 0 && !addingOutcome && (
            <p className="px-5 py-3 text-xs text-gray-400 italic">No outcomes yet</p>
          )}

          {outcomes.map((lo, i) => (
            <div key={lo.id} style={{ borderTop: i === 0 ? "none" : "1px solid #ede9cc" }}>
              <OutcomeRow outcome={lo} />
            </div>
          ))}

          {/* Inline add-outcome form */}
          {addingOutcome && (
            <div
              className="flex items-center gap-2 px-5 py-2.5"
              style={{ borderTop: outcomes.length > 0 ? "1px solid #ede9cc" : "none", backgroundColor: "#f5f3e0" }}
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
              />
              <button
                onClick={confirmAdd}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-gray-800 hover:opacity-80 transition-opacity shrink-0"
                style={{ backgroundColor: "#F5C842" }}
              >
                Add
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoursePageWrapper({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const course = mockCourses.find((c) => c.id === courseId) ?? mockCourses[0];

  const courseOutcomes = getOutcomesForCourse(courseId);
  const courseTopics = getTopicsForCourse(courseId);
  const worstOutcomes = [...courseOutcomes].sort((a, b) => a.mastery - b.mastery).slice(0, 10);

  const topicGroups = courseTopics.map((topic) => ({
    topic,
    outcomes: courseOutcomes.filter((o) => o.topicId === topic.id),
  }));
  const ungroupedOutcomes = courseOutcomes.filter((o) => !o.topicId);

  const [openTopics, setOpenTopics] = useState<Set<string>>(
    () => new Set(courseTopics.length > 0 ? [courseTopics[0].id] : [])
  );

  function toggleTopic(id: string) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          <span
            className="px-4 py-1 rounded-full text-xs font-bold text-gray-700"
            style={{ backgroundColor: "#D6EEF8" }}
          >
            {course.code}
          </span>
        }
      />

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Action buttons */}
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
          <button
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            + Add Learning Outcome
          </button>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Course mastery */}
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Course Mastery</h2>
            <p className="text-xs text-gray-500">Based on study sessions, assessment grades, and learning outcomes</p>
            <div className="text-4xl font-black text-gray-800">{course.mastery}%</div>
            <div className="w-full h-3 rounded-full bg-gray-200">
              <div
                className="h-3 rounded-full"
                style={{ width: `${course.mastery}%`, backgroundColor: "#5CB85C" }}
              />
            </div>
            <PlaceholderChart label="Mastery over time chart — coming soon" />
          </div>

          {/* Top 10 worst outcomes */}
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Top 10 Outcomes to Practice</h2>
            <p className="text-xs text-gray-500">Ranked worst to best — focus here first</p>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
              {worstOutcomes.map((lo, i) => (
                <div key={lo.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700">{lo.text}</p>
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
          </div>

          {/* Uploaded documents */}
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Uploaded Documents</h2>
            <p className="text-xs text-gray-500">Learning outcomes, practice questions, and assessments retrieved</p>
            <div className="flex flex-col gap-2">
              {mockDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{doc.name}</p>
                    <p className="text-xs text-gray-400">
                      {doc.outcomes} outcomes · {doc.questions} questions
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: "#D6EEF8", color: "#374151" }}
                  >
                    {doc.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Upload document */}
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

        {/* ── Learning Outcomes accordion ── */}
        <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Learning Outcomes</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {courseOutcomes.length} outcome{courseOutcomes.length !== 1 ? "s" : ""}
                {courseTopics.length > 0
                  ? ` across ${courseTopics.length} topic${courseTopics.length !== 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
            <button
              className="px-3 py-1.5 rounded-full text-xs font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#F5C842" }}
            >
              + Add Topic
            </button>
          </div>

          {/* One card per topic */}
          {topicGroups.length > 0 && (
            <div className="flex flex-col gap-3">
              {topicGroups.map(({ topic, outcomes }, idx) => (
                <TopicAccordionCard
                  key={topic.id}
                  topic={topic}
                  outcomes={outcomes}
                  index={idx}
                  isOpen={openTopics.has(topic.id)}
                  onToggle={() => toggleTopic(topic.id)}
                />
              ))}
            </div>
          )}

          {/* Ungrouped flat list — courses with no topics at all */}
          {topicGroups.length === 0 && ungroupedOutcomes.length > 0 && (
            <div className="flex flex-col gap-0">
              {ungroupedOutcomes.map((lo) => (
                <OutcomeRow key={lo.id} outcome={lo} />
              ))}
            </div>
          )}

          {courseOutcomes.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No outcomes yet — upload a document or add topics to get started.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
