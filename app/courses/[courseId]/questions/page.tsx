"use client";

import { use, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  mockCourses,
  getQuestionsForCourse,
  getTopicsForCourse,
  getOutcomesForCourse,
} from "@/lib/mockData";

export default function QuestionsPageWrapper({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const course = mockCourses.find((c) => c.id === courseId) ?? mockCourses[0];
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const topics = getTopicsForCourse(courseId);
  const allQuestions = getQuestionsForCourse(courseId);
  const outcomes = getOutcomesForCourse(courseId);

  // Derive question set based on active topic filter
  let filtered = allQuestions;
  if (activeTopic) {
    const outcomeIdsInTopic = new Set(
      outcomes.filter((o) => o.topicId === activeTopic).map((o) => o.id)
    );
    filtered = allQuestions.filter((q) => q.outcomeIds.some((id) => outcomeIdsInTopic.has(id)));
  }
  filtered = filtered.filter((q) => q.text.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#6B9EA0" }}>
      <NavBar
        centerContent={
          <span
            className="px-4 py-1 rounded-full text-xs font-bold text-gray-700"
            style={{ backgroundColor: "#D6EEF8" }}
          >
            {course.code} — Questions
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
              <p className="text-sm text-gray-800 flex-1 mr-4 line-clamp-1">{q.text}</p>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${q.mastery}%`,
                      backgroundColor: q.mastery < 50 ? "#FF6B6B" : q.mastery < 70 ? "#F5C842" : "#5CB85C",
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-600 w-9 text-right">{q.mastery}%</span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-center text-white text-sm py-8">No questions match your search.</p>
          )}
        </div>

        {/* Add question + back */}
        <div className="flex gap-3 justify-between mt-2">
          <Link
            href={`/courses/${courseId}`}
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            ← Back to Course
          </Link>
          <button
            className="px-5 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#F5C842" }}
          >
            + Add Question
          </button>
        </div>
      </main>
    </div>
  );
}
