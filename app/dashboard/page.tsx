"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";

type Course = {
  id: string;
  name: string;
  code: string | null;
  credits: number;
  isArchived: boolean;
  createdAt: string;
  courseMastery: number;
};

type PrioritizedTopic = {
  id: string;
  name: string;
  courseCode: string | null;
  avgMastery: number;
  needsWork: number;
};


function CourseCard({ course }: { course: Course }) {
  return (
    <div
      className="flex flex-col gap-3 p-6 rounded-3xl shadow-lg"
      style={{ backgroundColor: "#FEFEE8" }}
    >
      {(course.code || course.credits) && (
        <div className="flex items-center gap-2 flex-wrap">
          {course.code && (
            <span
              className="px-3 py-1 rounded-full text-xs font-bold text-gray-700"
              style={{ backgroundColor: "#D6EEF8" }}
            >
              {course.code}
            </span>
          )}
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-gray-700"
            style={{ backgroundColor: "#D6F8E8" }}
          >
            {course.credits} cr
          </span>
        </div>
      )}
      <p className="text-sm font-semibold text-gray-800">{course.name}</p>
      <p className="text-xs text-gray-500">
        Added{" "}
        {new Date(course.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full"
            style={{
              width: `${course.courseMastery}%`,
              backgroundColor:
                course.courseMastery < 50 ? "#FF6B6B" : course.courseMastery < 70 ? "#F5C842" : "#5CB85C",
            }}
          />
        </div>
        <span className="text-xs font-bold text-gray-500 shrink-0">{course.courseMastery}%</span>
      </div>

      <Link
        href={`/courses/${course.id}`}
        className="mt-auto w-full text-center py-2 rounded-full text-sm font-bold text-gray-800 transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#F5C842" }}
      >
        View Course
      </Link>
    </div>
  );
}


function AddCourseModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (course: Course) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, credits }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add course");
        return;
      }
      const course: Course = await res.json();
      onAdded(course);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-md p-8 rounded-3xl shadow-lg flex flex-col gap-4"
        style={{ backgroundColor: "#FEFEE8" }}
      >
        <h2 className="text-base font-bold text-gray-800">Add Course</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Course Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
          />
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Course Code (optional)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
            />
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs text-gray-500 font-medium px-1">Credits</label>
              <input
                type="number"
                min={1}
                max={6}
                value={credits}
                onChange={(e) => setCredits(Math.max(1, Math.min(6, parseInt(e.target.value) || 3)))}
                className="w-16 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 text-center"
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm font-semibold text-gray-600 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#e5e7eb" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 rounded-full text-sm font-bold text-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#F5C842" }}
            >
              {submitting ? "Adding…" : "Add Course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [topicsToFocus, setTopicsToFocus] = useState<PrioritizedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const studiedCourses = courses.filter((c) => c.courseMastery > 0);
  const totalCredits = studiedCourses.reduce((sum, c) => sum + c.credits, 0);
  const overallMastery =
    totalCredits > 0
      ? Math.round(studiedCourses.reduce((sum, c) => sum + c.courseMastery * c.credits, 0) / totalCredits)
      : null;

  // ✅ Stable fetch function — won't be recreated on every render
  const loadDashboard = useCallback(async () => {
    try {
      const r = await fetch("/api/courses");
      if (!r.ok) return;
      const data: Course[] = await r.json();
      if (!Array.isArray(data)) return;
      setCourses(data);

      const details = await Promise.all(
        data.map((c) =>
          fetch(`/api/courses/${c.id}`)
            .then((r) => r.json())
            .catch(() => null)
        )
      );

      const allTopics: PrioritizedTopic[] = details
        .flatMap((detail, i) => {
          if (!detail?.topics) return [];
          const course = data[i];
          return (
            detail.topics as {
              id: string;
              name: string;
              outcomes: { mastery: number; hasMastery: boolean }[];
            }[]
          )
            .filter((t) => t.outcomes.length > 0 && t.outcomes.some((o) => o.hasMastery))
            .map((t) => {
              const avgMastery = Math.round(
                t.outcomes.reduce((sum, o) => sum + o.mastery, 0) / t.outcomes.length
              );
              const needsWork = t.outcomes.filter((o) => o.mastery < 70).length;
              return {
                id: t.id,
                name: t.name,
                courseCode: course.code,
                avgMastery,
                needsWork,
              };
            });
        })
        .sort((a, b) => a.avgMastery - b.avgMastery)
        .slice(0, 3);

      setTopicsToFocus(allTopics);
    } finally {
      setLoading(false);
    }
  }, []); // ✅ No dependencies — this only needs to run once on mount

  // ✅ Depends on the stable callback, not an inline function
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar />

      {showModal && (
        <AddCourseModal
          onClose={() => setShowModal(false)}
          onAdded={(course) => setCourses((prev) => [course, ...prev])}
        />
      )}

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Stat Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800">Overall Term Mastery</h2>
                <p className="text-xs text-gray-500 mt-0.5">Across all active courses</p>
              </div>
              <span
                className="text-3xl font-black"
                style={{
                  color:
                    overallMastery === null ? "#9ca3af"
                    : overallMastery < 50 ? "#FF6B6B"
                    : overallMastery < 70 ? "#F5C842"
                    : "#5CB85C",
                }}
              >
                {overallMastery !== null ? `${overallMastery}%` : "—"}
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-8 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : courses.filter((c) => !c.isArchived).length === 0 ? (
              <p className="text-xs text-gray-400 italic">Add a course to start tracking mastery.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {courses
                  .filter((c) => !c.isArchived)
                  .sort((a, b) => a.courseMastery - b.courseMastery)
                  .map((course) => {
                    const color =
                      course.courseMastery < 50 ? "#FF6B6B"
                      : course.courseMastery < 70 ? "#F5C842"
                      : "#5CB85C";
                    return (
                      <div key={course.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700 truncate max-w-[75%]">
                            {course.code ?? course.name}
                          </span>
                          <span className="text-xs font-bold" style={{ color }}>
                            {course.courseMastery}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{ width: `${course.courseMastery}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
            <div>
              <h2 className="text-base font-bold text-gray-800">Topics to Prioritize</h2>
              <p className="text-xs text-gray-500 mt-0.5">Weakest topics based on your current mastery</p>
            </div>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : topicsToFocus.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Practice some questions first — topics you&apos;ve attempted will appear here ranked by mastery.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {topicsToFocus.map((topic) => (
                  <div key={topic.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{topic.name}</p>
                        {topic.courseCode && (
                          <span className="text-xs text-gray-400 shrink-0">{topic.courseCode}</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-500 shrink-0">{topic.avgMastery}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${topic.avgMastery}%`,
                          backgroundColor: topic.avgMastery < 50 ? "#FF6B6B" : topic.avgMastery < 70 ? "#F5C842" : "#5CB85C",
                        }}
                      />
                    </div>
                    {topic.needsWork > 0 && (
                      <p className="text-xs text-gray-400">
                        {topic.needsWork} outcome{topic.needsWork !== 1 ? "s" : ""} need work
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Course Cards */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Your Courses</h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            + Add Course
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-48 rounded-3xl shadow-lg animate-pulse"
                style={{ backgroundColor: "#FEFEE8", opacity: 0.6 }}
              />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-3xl shadow-lg gap-3"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            <p className="text-sm font-semibold text-gray-500">No courses yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#F5C842" }}
            >
              Add your first course
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        {/* Contact Form */}
        <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
          <h2 className="text-base font-bold text-gray-800">Get in Touch</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
            />
            <input
              type="email"
              placeholder="Your email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
            />
          </div>
          <textarea
            placeholder="Your message"
            rows={3}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
          />
          <button
            className="self-start px-6 py-2 rounded-full text-sm font-bold text-gray-800 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#F5C842" }}
          >
            Submit
          </button>
        </div>
      </main>
    </div>
  );
}