"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function BugReportForm() {
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, description, page }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong — please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMsg("Network error — please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        className="p-6 rounded-3xl shadow-lg"
        style={{ backgroundColor: "#FEFEE8" }}
      >
        <div
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ backgroundColor: "#D6F8E8" }}
        >
          <span className="text-xl" aria-hidden="true">✓</span>
          <p className="text-sm font-bold text-gray-800">
            Thanks, we&apos;ll look into it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-6 rounded-3xl shadow-lg flex flex-col gap-4"
      style={{ backgroundColor: "#FEFEE8" }}
    >
      <div>
        <h2 className="text-base font-bold text-gray-800">Report a Bug</h2>
        <p className="text-xs text-gray-500 mt-1">
          Found something broken? Let us know and we&apos;ll fix it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="bug-email" className="text-xs font-semibold text-gray-600">
            Your email <span className="text-red-400">*</span>
          </label>
          <input
            id="bug-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === "loading"}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="bug-description" className="text-xs font-semibold text-gray-600">
            What went wrong? <span className="text-red-400">*</span>
          </label>
          <textarea
            id="bug-description"
            placeholder="Describe what happened and what you expected to happen…"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={status === "loading"}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="bug-page" className="text-xs font-semibold text-gray-600">
            Which page or feature?{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="bug-page"
            type="text"
            placeholder="e.g. Questions page, session results…"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            disabled={status === "loading"}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-50"
          />
        </div>

        {status === "error" && errorMsg && (
          <p className="text-xs text-red-600" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={status === "loading" || !email.trim() || !description.trim()}
            className="px-6 py-2 rounded-full text-sm font-bold text-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#F5C842" }}
          >
            {status === "loading" ? "Sending…" : "Submit Report"}
          </button>
        </div>
      </form>
    </div>
  );
}
