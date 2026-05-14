"use client";

import Link from "next/link";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import MasteryPanel from "./_components/MasteryPanel";
import TopOutcomesPanel from "./_components/TopOutcomesPanel";
import OutcomesPanel from "./_components/OutcomesPanel";
import DocumentsPanel from "./_components/DocumentsPanel";
import type { MasteryPoint, Top10Outcome, TopicWithOutcomes } from "./_components/types";

type CourseData = {
  id: string;
  name: string;
  code: string | null;
  isArchived: boolean;
  courseMastery: number;
  topics: TopicWithOutcomes[];
};

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [masteryHistory, setMasteryHistory] = useState<MasteryPoint[]>([]);
  const [top10, setTop10] = useState<Top10Outcome[]>([]);
  const [loadingTop10, setLoadingTop10] = useState(true);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCourse() {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) { router.push("/dashboard"); return; }
      const data: CourseData = await res.json();
      if (cancelled) return;

      setCourse(data);
      setLoading(false);

      fetch(`/api/courses/${courseId}/mastery-history`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((d) => { if (!cancelled && Array.isArray(d.history)) setMasteryHistory(d.history); })
        .catch(() => {});

      setLoadingTop10(true);
      fetch(`/api/courses/${courseId}/top-outcomes`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((d) => { if (!cancelled && Array.isArray(d.top10)) setTop10(d.top10); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoadingTop10(false); });
    }

    void fetchCourse();
    return () => { cancelled = true; };
  }, [courseId, router, refreshKey]);

  async function confirmArchive() {
    await fetch(`/api/courses/${courseId}`, { method: "PATCH" });
    router.push("/dashboard");
  }

  async function confirmDelete() {
    await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
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
          <MasteryPanel courseMastery={course.courseMastery} masteryHistory={masteryHistory} />
          <TopOutcomesPanel top10={top10} loading={loadingTop10} />
          <DocumentsPanel courseId={courseId} allOutcomes={allOutcomes} />
        </div>

        <OutcomesPanel
          courseId={courseId}
          topics={course.topics}
onRefresh={async () => setRefreshKey((k) => k + 1)}
        />

        <div className="flex justify-end">
          {!showArchiveConfirm && !showDeleteConfirm && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                style={{ backgroundColor: "#e5e7eb" }}
              >
                Archive Course
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-white hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "#ef4444" }}
              >
                Delete Course
              </button>
            </div>
          )}

          {showArchiveConfirm && (
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

          {showDeleteConfirm && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow" style={{ backgroundColor: "#FEFEE8" }}>
              <div>
                <p className="text-sm font-semibold text-red-600">Delete this course permanently?</p>
                <p className="text-xs text-gray-500 mt-0.5">This will erase all topics, outcomes, questions, and session history. It cannot be recovered.</p>
              </div>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-white hover:opacity-80 shrink-0"
                style={{ backgroundColor: "#ef4444" }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-gray-500 hover:text-gray-700 shrink-0"
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