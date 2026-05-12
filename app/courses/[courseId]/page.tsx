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

type MasteryPoint = { sessionNumber: number; date: string; mastery: number };

function MasteryChart({ history, currentMastery }: { history: MasteryPoint[]; currentMastery: number }) {
  const W = 400;
  const H = 120;
  const padX = 28;
  const padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const color =
    currentMastery < 50 ? "#FF6B6B" : currentMastery < 70 ? "#F5C842" : "#5CB85C";

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-xs text-center px-4">
        Complete a study session to see your progress over time
      </div>
    );
  }

  if (history.length === 1) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-2xl bg-gray-50 gap-1">
        <span className="text-xs text-gray-400">Session 1 complete</span>
        <span className="text-2xl font-black" style={{ color }}>{history[0].mastery}%</span>
        <span className="text-xs text-gray-400">Do another session to see your trend</span>
      </div>
    );
  }

  const xStep = innerW / (history.length - 1);
  const pts = history.map((p, i) => ({
    x: padX + i * xStep,
    y: padY + innerH - (p.mastery / 100) * innerH,
    mastery: p.mastery,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${padY + innerH} L${pts[0].x},${padY + innerH} Z`;
  const gradId = "masteryGrad";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 128 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[25, 50, 75, 100].map((pct) => {
        const y = padY + innerH - (pct / 100) * innerH;
        return (
          <g key={pct}>
            <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={padX - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="#9ca3af">{pct}</text>
          </g>
        );
      })}
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" />
          <text x={p.x} y={H - 1} textAnchor="middle" fontSize="8" fill="#9ca3af">S{i + 1}</text>
        </g>
      ))}
    </svg>
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
  const [masteryHistory, setMasteryHistory] = useState<MasteryPoint[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; purpose: string; createdAt: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState("");
  const [previewData, setPreviewData] = useState<null | { topics: Array<{ name: string; selected: boolean; outcomes: Array<{ name: string; selected: boolean }> }> }>(null);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    fetch(`/api/courses/${courseId}/mastery-history`)
      .then((r) => { if (!r.ok) throw new Error("failed"); return r.json(); })
      .then((d) => { if (Array.isArray(d.history)) setMasteryHistory(d.history); })
      .catch(() => {});
    fetch(`/api/courses/${courseId}/documents`)
      .then((r) => r.json())
      .then((docs) => { if (Array.isArray(docs)) setDocuments(docs); });
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadPurpose) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", uploadPurpose);

    const res = await fetch(`/api/courses/${courseId}/documents`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setUploading(false);

    if (data.shouldPreview && data.extracted) {
      setPreviewData({
        topics: data.extracted.topics.map((t: any) => ({
          name: t.name,
          selected: true,
          outcomes: t.outcomes.map((o: string) => ({ name: o, selected: true })),
        })),
      });
    } else {
      await fetchCourse();
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteDocument(documentId: string) {
    await fetch(`/api/courses/${courseId}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
  }

  async function handleConfirmExtraction() {
    if (!previewData) return;
    setConfirmingSave(true);
    await fetch(`/api/courses/${courseId}/documents/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: previewData.topics }),
    });
    setConfirmingSave(false);
    setPreviewData(null);
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
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-gray-800">Course Mastery</h2>
              <span
                className="text-3xl font-black"
                style={{
                  color:
                    course.courseMastery < 50 ? "#FF6B6B"
                    : course.courseMastery < 70 ? "#F5C842"
                    : "#5CB85C",
                }}
              >
                {course.courseMastery}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${course.courseMastery}%`,
                  backgroundColor:
                    course.courseMastery < 50 ? "#FF6B6B"
                    : course.courseMastery < 70 ? "#F5C842"
                    : "#5CB85C",
                }}
              />
            </div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Progress over time</p>
            <MasteryChart history={masteryHistory} currentMastery={course.courseMastery} />
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

          {/* Uploaded Documents */}
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Uploaded Documents</h2>
            <p className="text-xs text-gray-500">Files uploaded for this course</p>
            {documents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No documents uploaded yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="flex-1 min-w-0 mr-2">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-gray-700 hover:underline truncate block"
                      >
                        {doc.name}
                      </a>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#D6EEF8", color: "#374151" }}>
                        {doc.purpose}
                      </span>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors px-1"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Document */}
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-sm font-bold text-gray-800">Upload Document</h2>
            <p className="text-xs text-gray-500">PDF only - AI will extract learning outcomes from lecture slides</p>
            <select
              value={uploadPurpose}
              onChange={(e) => setUploadPurpose(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 bg-white"
            >
              <option value="">Select upload purpose…</option>
              <option value="outcomes">Learning Outcomes / Course Outline</option>
              <option value="lecture">Lecture Slides / Notes</option>
              <option value="assignment">Assignment</option>
              <option value="quiz">Quiz / Exam</option>
            </select>

            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 text-sm transition-colors"
              style={{
                opacity: uploadPurpose && !uploading ? 1 : 0.5,
                cursor: uploadPurpose && !uploading ? "pointer" : "not-allowed",
                backgroundColor: "transparent",
              }}
            >
              <span className="text-2xl mb-1">📄</span>
              {uploading ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  <span className="text-xs">Uploading & extracting…</span>
                  <span className="text-xs text-gray-400">This can take 20–30 seconds</span>
                </div>
              ) : (
                <>
                  <span>{uploadPurpose ? "Click to upload PDF" : "Select a purpose first"}</span>
                  <span className="text-xs mt-1">PDF up to 20MB</span>
                </>
              )}
            </label>

            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || !uploadPurpose}
            />
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

      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-lg rounded-3xl shadow-xl flex flex-col gap-4 h-[85vh]" style={{ backgroundColor: "#FEFEE8" }}>
            <div className="p-6 pb-0">
              <h2 className="text-sm font-bold text-gray-800">AI Extracted Learning Outcomes</h2>
              <p className="text-xs text-gray-500 mt-1">Review and deselect anything you don't want to add. Then confirm.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-3">
              {previewData.topics.map((topic, ti) => (
                <div key={ti} className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e3d0" }}>
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 cursor-pointer"
                    style={{ backgroundColor: "#ede9cc" }}
                    onClick={() => setPreviewData((prev) => {
                      if (!prev) return prev;
                      const topics = [...prev.topics];
                      topics[ti] = { ...topics[ti], selected: !topics[ti].selected };
                      return { ...prev, topics };
                    })}
                  >
                    <div
                      className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: topic.selected ? "#d4a800" : "#d1d5db", backgroundColor: topic.selected ? "#d4a800" : "white" }}
                    >
                      {topic.selected && (
                        <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-800">{topic.name}</span>
                  </div>

                  {topic.outcomes.map((outcome, oi) => (
                    <div
                      key={oi}
                      className="flex items-center gap-2 px-5 py-2 cursor-pointer hover:bg-[#f5f3e0]"
                      style={{ borderTop: "1px solid #ede9cc" }}
                      onClick={() => setPreviewData((prev) => {
                        if (!prev) return prev;
                        const topics = [...prev.topics];
                        const outcomes = [...topics[ti].outcomes];
                        outcomes[oi] = { ...outcomes[oi], selected: !outcomes[oi].selected };
                        topics[ti] = { ...topics[ti], outcomes };
                        return { ...prev, topics };
                      })}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: outcome.selected ? "#d4a800" : "#d1d5db", backgroundColor: outcome.selected ? "#d4a800" : "white" }}
                      >
                        {outcome.selected && (
                          <svg width="7" height="5" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-700">{outcome.name}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => { setPreviewData(null); fetchCourse(); }}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-700"
                style={{ backgroundColor: "#e5e7eb" }}
              >
                Skip
              </button>
              <button
                onClick={handleConfirmExtraction}
                disabled={confirmingSave}
                className="flex-1 py-2 rounded-full text-xs font-bold text-gray-800 hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "#F5C842" }}
              >
                {confirmingSave ? "Saving…" : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}