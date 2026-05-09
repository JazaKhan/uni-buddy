"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import {
  mockCourses,
  getTopicsForCourse,
  getQuestionCountForTopic,
  type Topic,
} from "@/lib/mockData";

export default function SessionSetupWrapper({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const course = mockCourses.find((c) => c.id === courseId) ?? mockCourses[0];
  const topics = getTopicsForCourse(courseId);
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = topics.length > 0 && selected.size === topics.length;

  function toggleTopic(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(topics.map((t) => t.id)));
    }
  }

  function startSession() {
    const topicParam = Array.from(selected).join(",");
    router.push(`/courses/${courseId}/session?topics=${topicParam}`);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar
        centerContent={
          <span
            className="px-4 py-1 rounded-full text-xs font-bold text-gray-700"
            style={{ backgroundColor: "#D6EEF8" }}
          >
            {course.code} — Session Setup
          </span>
        }
      />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl flex flex-col gap-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black text-white">What do you want to practice today?</h1>
            <p className="text-sm text-white/70 mt-1">Select one or more topics to include in your session.</p>
          </div>

          {/* Select All toggle */}
          {topics.length > 0 && (
            <button
              onClick={toggleAll}
              className="self-start text-xs font-bold text-white/80 hover:text-white underline underline-offset-2 transition-colors"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          )}

          {/* Topic cards */}
          {topics.length > 0 ? (
            <div className="flex flex-col gap-3">
              {topics.map((topic) => {
                const count = getQuestionCountForTopic(topic.id, courseId);
                const isSelected = selected.has(topic.id);
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
                    {/* Checkbox */}
                    <div
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                      style={{
                        borderColor: isSelected ? "#d4a800" : "#d1d5db",
                        backgroundColor: isSelected ? "#d4a800" : "white",
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Topic info */}
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{topic.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {count} question{count !== 1 ? "s" : ""} available
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className="p-6 rounded-2xl shadow-md text-center"
              style={{ backgroundColor: "#FEFEE8" }}
            >
              <p className="text-sm text-gray-500">No topics found for this course.</p>
              <p className="text-xs text-gray-400 mt-1">Add topics from the Course page first.</p>
            </div>
          )}

          {/* Start Session button */}
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
              disabled={selected.size === 0}
              className="flex-1 py-3 rounded-full text-sm font-bold text-gray-800 shadow transition-opacity"
              style={{
                backgroundColor: "#F5C842",
                opacity: selected.size > 0 ? 1 : 0.45,
                cursor: selected.size > 0 ? "pointer" : "not-allowed",
              }}
            >
              Start Session →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
