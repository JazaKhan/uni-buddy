"use client";

import Link from "next/link";
import NavBar from "@/components/NavBar";
import { mockCourses } from "@/lib/mockData";
import { useState } from "react";

function PlaceholderChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 text-sm">
      {label}
    </div>
  );
}

function CourseCard({ course }: { course: (typeof mockCourses)[0] }) {
  return (
    <div
      className="flex flex-col gap-3 p-6 rounded-3xl shadow-lg"
      style={{ backgroundColor: "#FEFEE8" }}
    >
      <span
        className="self-start px-3 py-1 rounded-full text-xs font-bold text-gray-700"
        style={{ backgroundColor: "#D6EEF8" }}
      >
        {course.code}
      </span>
      <p className="text-sm font-semibold text-gray-800">{course.fullName}</p>
      <p className="text-xs text-gray-500">
        {course.startDate} – {course.endDate}
      </p>
      <p className="text-xs text-gray-500">
        {course.instructor} · {course.email}
      </p>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Mastery</span>
          <span>{course.mastery}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full"
            style={{ width: `${course.mastery}%`, backgroundColor: "#5CB85C" }}
          />
        </div>
      </div>

      <Link
        href={`/courses/${course.id}`}
        className="mt-1 w-full text-center py-2 rounded-full text-sm font-bold text-gray-800 transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#F5C842" }}
      >
        View Course
      </Link>
    </div>
  );
}

type TimeTab = "daily" | "weekly" | "overall";

const timeData: Record<TimeTab, { code: string; hours: number }[]> = {
  daily: [
    { code: "COMP2511", hours: 2.5 },
    { code: "CPSC 213", hours: 1.8 },
    { code: "MATH1141", hours: 1.2 },
    { code: "PSYC1001", hours: 0.5 },
  ],
  weekly: [
    { code: "CPSC 213", hours: 12.5 },
    { code: "COMP2511", hours: 8.0 },
    { code: "MATH1141", hours: 5.5 },
    { code: "PSYC1001", hours: 3.5 },
  ],
  overall: [
    { code: "COMP2511", hours: 14.5 },
    { code: "CPSC 213", hours: 11.3 },
    { code: "MATH1141", hours: 10.2 },
    { code: "PSYC1001", hours: 8.0 },
  ],
};

const periodLabel: Record<TimeTab, string> = {
  daily: "today",
  weekly: "this week",
  overall: "overall",
};

export default function DashboardPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [timeTab, setTimeTab] = useState<TimeTab>("weekly");

  const overallMastery = Math.round(
    mockCourses.reduce((sum, c) => sum + c.mastery, 0) / mockCourses.length
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#8FAF76" }}>
      <NavBar />

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {/* Stat Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-base font-bold text-gray-800">Overall Term Mastery</h2>
            <p className="text-xs text-gray-500">Average across all courses weighted by credit</p>
            <div className="text-4xl font-black text-gray-800">{overallMastery}%</div>
            <PlaceholderChart label="Mastery trend chart — coming soon" />
          </div>

          <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
            <h2 className="text-base font-bold text-gray-800">Time Spent Studying</h2>

            {/* Toggle pills */}
            <div className="flex gap-1.5 self-start p-1 rounded-full bg-gray-100">
              {(["daily", "weekly", "overall"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTimeTab(tab)}
                  className="px-3 py-1 rounded-full text-xs font-bold capitalize transition-all"
                  style={{
                    backgroundColor: timeTab === tab ? "#F5C842" : "transparent",
                    color: timeTab === tab ? "#1f2937" : "#6b7280",
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Per-course breakdown */}
            <div className="flex flex-col gap-2.5">
              {(() => {
                const rows = timeData[timeTab];
                const max = rows[0].hours;
                return rows.map((row) => (
                  <div key={row.code} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-700 w-20 shrink-0">{row.code}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(row.hours / max) * 100}%`, backgroundColor: "#5CB85C" }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600 w-10 text-right shrink-0">
                      {row.hours.toFixed(1)}h
                    </span>
                  </div>
                ));
              })()}
            </div>

            {/* Total */}
            <p className="text-xs text-gray-400 mt-1">
              Total:{" "}
              <span className="font-bold text-gray-600">
                {timeData[timeTab].reduce((s, r) => s + r.hours, 0).toFixed(1)}h
              </span>{" "}
              {periodLabel[timeTab]}
            </p>
          </div>
        </div>

        {/* Course Cards */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Your Courses</h2>
          <button
            className="px-4 py-2 rounded-full text-sm font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#FEFEE8" }}
          >
            + Add Course
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mockCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

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
