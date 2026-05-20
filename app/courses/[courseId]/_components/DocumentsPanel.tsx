"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DocumentItem, ExtractedQuestion, Outcome } from "./types";

type PreviewTopic = { name: string; selected: boolean; outcomes: { name: string; selected: boolean }[] };

export default function DocumentsPanel({
  courseId,
  allOutcomes,
}: {
  courseId: string;
  allOutcomes: Outcome[];
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState("");
  const [previewData, setPreviewData] = useState<{ topics: PreviewTopic[] } | null>(null);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [questionPreviewData, setQuestionPreviewData] = useState<ExtractedQuestion[] | null>(null);
  const [confirmingQuestions, setConfirmingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/documents`)
      .then((r) => r.json())
      .then((docs) => { if (Array.isArray(docs)) setDocuments(docs); })
      .catch(() => {});
  }, [courseId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadPurpose) return;

    if (file.size > 25 * 1024 * 1024) {
      setError("File too large — maximum size is 25 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const magic = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46 && magic[4] === 0x2D;
    if (!isPdf) {
      setError("Only PDF files are accepted.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    // Step 1: Get a signed upload URL from the server (tiny JSON request — no file body)
    const urlRes = await fetch(`/api/courses/${courseId}/documents/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, purpose: uploadPurpose }),
    });

    if (!urlRes.ok) {
      setUploading(false);
      setError("Upload failed — please try again.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const { filePath, token } = await urlRes.json();

    // Step 2: Upload directly from browser to Supabase (bypasses Vercel's 4.5MB limit)
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("course-documents")
      .uploadToSignedUrl(filePath, token, file, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      setUploading(false);
      setError("Upload failed — please try again.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Step 3: Notify server to create the DB record and run AI extraction
    const res = await fetch(`/api/courses/${courseId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, fileName: file.name, purpose: uploadPurpose }),
    });

    if (!res.ok) {
      setUploading(false);
      setError("Processing failed — please try again.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const data: {
      document: DocumentItem;
      shouldPreview?: boolean;
      extracted?: { topics: Array<{ name: string; outcomes: string[] }> };
      shouldPreviewQuestions?: boolean;
      extractedQuestions?: Array<{ content: string; answer: string | null; outcomeIds: string[]; outcomeSummary: string }>;
    } = await res.json();

    setUploading(false);

    if (data.shouldPreview && data.extracted) {
      setPreviewData({
        topics: data.extracted.topics.map((t) => ({
          name: t.name,
          selected: true,
          outcomes: t.outcomes.map((o) => ({ name: o, selected: true })),
        })),
      });
    } else if (data.shouldPreviewQuestions && data.extractedQuestions) {
      setQuestionPreviewData(
        data.extractedQuestions.map((q) => ({
          ...q,
          selected: true,
          showAnswer: false,
        }))
      );
    } else {
      setDocuments((prev) => [data.document, ...prev]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleToggleActive(documentId: string, isActive: boolean) {
    setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, isActive } : d));
    const res = await fetch(`/api/courses/${courseId}/documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, isActive }),
    });
    if (!res.ok) {
      setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, isActive: !isActive } : d));
      setError("Failed to update document — please try again.");
    }
  }

  async function handleOpenDocument(docId: string) {
    const res = await fetch(`/api/courses/${courseId}/documents/signed-url?documentId=${docId}`);
    if (!res.ok) { setError("Failed to open document — please try again."); return; }
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDeleteDocument(documentId: string) {
    const res = await fetch(`/api/courses/${courseId}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    if (!res.ok) { setError("Failed to delete document — please try again."); return; }
    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
  }

  async function handleConfirmExtraction() {
    if (!previewData) return;
    setConfirmingSave(true);
    const res = await fetch(`/api/courses/${courseId}/documents/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: previewData.topics }),
    });
    setConfirmingSave(false);
    if (!res.ok) { setError("Failed to save outcomes — please try again."); return; }
    setPreviewData(null);
    const docs = await fetch(`/api/courses/${courseId}/documents`).then((r) => r.json());
    if (Array.isArray(docs)) setDocuments(docs);
  }

  async function handleConfirmQuestions() {
    if (!questionPreviewData) return;
    setConfirmingQuestions(true);
    const selected = questionPreviewData.filter((q) => q.selected);
    const res = await fetch(`/api/courses/${courseId}/documents/confirm-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: selected.map((q) => ({
          content: q.content,
          answer: q.answer,
          outcomeIds: q.outcomeIds,
        })),
      }),
    });
    setConfirmingQuestions(false);
    if (!res.ok) { setError("Failed to save questions — please try again."); return; }
    setQuestionPreviewData(null);
  }

  const outcomeMap = new Map(allOutcomes.map((o) => [o.id, o.name]));

  return (
    <>
      {/* Uploaded Documents */}
      <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-3" style={{ backgroundColor: "#FEFEE8" }}>
        <h2 className="text-sm font-bold text-gray-800">Uploaded Documents</h2>
        <p className="text-xs text-gray-500">Files uploaded for this course</p>
        {error && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
        )}
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No documents uploaded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0 mr-2">
                  <button
                    onClick={() => handleOpenDocument(doc.id)}
                    className="text-xs font-semibold text-gray-700 hover:underline truncate block text-left"
                  >
                    {doc.name}
                  </button>
                  <p className="text-xs text-gray-400">
                    {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(doc.id, !doc.isActive)}
                    title={doc.isActive ? "Used by AI — click to disable" : "Disabled — click to enable"}
                    className="relative w-8 h-4 rounded-full transition-colors shrink-0 focus:outline-none"
                    style={{ backgroundColor: doc.isActive ? "#5CB85C" : "#d1d5db" }}
                  >
                    <span
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
                      style={{ left: doc.isActive ? "17px" : "2px" }}
                    />
                  </button>
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

      {/* Question Preview Modal */}
      {questionPreviewData && (() => {
        const selectedCount = questionPreviewData.filter((q) => q.selected).length;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="w-full max-w-lg rounded-3xl shadow-xl flex flex-col h-[85vh]" style={{ backgroundColor: "#FEFEE8" }}>
              <div className="p-6 pb-3 shrink-0">
                <h2 className="text-sm font-bold text-gray-800">AI Extracted Questions</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {questionPreviewData.length} question{questionPreviewData.length !== 1 ? "s" : ""} found — deselect any you don't want to add.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-3 pb-2">
                {questionPreviewData.map((q, qi) => (
                  <div key={qi} className="rounded-2xl overflow-y-auto" style={{ border: "1px solid #e5e3d0" }}>
                    <div
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                      style={{ backgroundColor: q.selected ? "#F5C842" : "#ede9cc" }}
                      onClick={() => setQuestionPreviewData((prev) => {
                        if (!prev) return prev;
                        const next = [...prev];
                        next[qi] = { ...next[qi], selected: !next[qi].selected };
                        return next;
                      })}
                    >
                      <div
                        className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5"
                        style={{ borderColor: q.selected ? "#d4a800" : "#d1d5db", backgroundColor: q.selected ? "#d4a800" : "white" }}
                      >
                        {q.selected && (
                          <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-800 flex-1">{q.content}</p>
                    </div>

                    <div className="px-4 py-2.5" style={{ backgroundColor: "#FEFEE8" }}>
                      {q.outcomeIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {q.outcomeIds.map((id) => (
                            <span key={id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#D6EEF8", color: "#374151" }}>
                              {outcomeMap.get(id) ?? id}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">{q.outcomeSummary}</p>
                      )}

                      {q.answer !== null && (
                        <div className="mt-2">
                          <button
                            onClick={() => setQuestionPreviewData((prev) => {
                              if (!prev) return prev;
                              const next = [...prev];
                              next[qi] = { ...next[qi], showAnswer: !next[qi].showAnswer };
                              return next;
                            })}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            {q.showAnswer ? "Hide answer ▲" : "Show answer ▼"}
                          </button>
                          {q.showAnswer && (
                            <div className="mt-1.5 px-3 py-2 rounded-xl text-xs text-gray-700 bg-gray-100">
                              {q.answer}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 p-6 pt-3 shrink-0">
                <button
                  onClick={() => setQuestionPreviewData(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-700"
                  style={{ backgroundColor: "#e5e7eb" }}
                >
                  Skip
                </button>
                <button
                  onClick={handleConfirmQuestions}
                  disabled={confirmingQuestions || selectedCount === 0}
                  className="flex-1 py-2 rounded-full text-xs font-bold text-gray-800 hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "#F5C842" }}
                >
                  {confirmingQuestions ? "Saving…" : `Add ${selectedCount} Question${selectedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Outcomes Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-lg rounded-3xl shadow-xl flex flex-col gap-4 h-[85vh]" style={{ backgroundColor: "#FEFEE8" }}>
            <div className="p-6 pb-0">
              <h2 className="text-sm font-bold text-gray-800">AI Extracted Learning Outcomes</h2>
              <p className="text-xs text-gray-500 mt-1">Review and deselect anything you don't want to add. Then confirm.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-3">
              {previewData.topics.map((topic, ti) => (
                <div key={ti} className="rounded-2xl overflow-y-auto" style={{ border: "1px solid #e5e3d0" }}>
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
                  {topic.selected && (
                    <div className="flex flex-col divide-y divide-gray-100 bg-white">
                      {topic.outcomes.map((outcome, oi) => (
                        <div
                          key={oi}
                          className="flex items-center gap-2 px-5 py-2.5 cursor-pointer hover:bg-gray-50"
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
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 px-6 pb-6 shrink-0">
              <button
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-700"
                style={{ backgroundColor: "#e5e7eb" }}
              >
                Cancel
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
    </>
  );
}
