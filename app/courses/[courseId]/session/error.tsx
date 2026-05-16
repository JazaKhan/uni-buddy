"use client";

import Link from "next/link";

export default function Error({
  error: _error,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#8FAF76" }}
    >
      <div
        className="flex flex-col items-center gap-4 p-10 rounded-3xl shadow-lg text-center max-w-sm w-full"
        style={{ backgroundColor: "#FEFEE8" }}
      >
        <h1 className="text-2xl font-bold text-gray-800">Session failed</h1>
        <p className="text-gray-600 text-sm">Something went wrong during your study session. Your progress up to this point has been saved.</p>
        <Link
          href="/dashboard"
          className="mt-2 px-6 py-2 rounded-full font-semibold text-gray-800 shadow transition hover:brightness-95 active:scale-95"
          style={{ backgroundColor: "#F5C842" }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
