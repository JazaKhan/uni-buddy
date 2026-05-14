"use client";

import { useState, useRef, useEffect } from "react";
import type { TopicWithOutcomes, Outcome } from "./types";

function OutcomeRow({
  outcome,
  editingOutcomes,
  onDelete,
  isDeleting,
}: {
  outcome: Outcome;
  editingOutcomes: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
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
      {editingOutcomes && (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors shrink-0 w-5 text-center leading-none"
          title="Delete outcome"
        >
          {isDeleting ? "…" : "×"}
        </button>
      )}
    </div>
  );
}

function TopicAccordionCard({
  topic,
  index,
  isOpen,
  onToggle,
  onAddOutcome,
  editingOutcomes,
  onDeleteTopic,
  onDeleteOutcome,
  deletingId,
}: {
  topic: TopicWithOutcomes;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onAddOutcome: (topicId: string, name: string) => Promise<void>;
  editingOutcomes: boolean;
  onDeleteTopic: () => void;
  onDeleteOutcome: (outcomeId: string) => void;
  deletingId: string | null;
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

  const colors = ["#D6EEF8", "#D6F8E8", "#F8F0D6", "#F8D6D6", "#EDD6F8"];
  const bg = colors[index % colors.length];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e3d0" }}>
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
        style={{ backgroundColor: bg }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-bold text-gray-800 truncate">{topic.name}</span>
          <span className="text-xs text-gray-500 shrink-0">
            {topic.outcomes.length} outcome{topic.outcomes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editingOutcomes && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteTopic(); }}
              className="text-xs text-red-400 hover:text-red-600 transition-colors px-2"
              title="Delete topic"
            >
              Delete topic
            </button>
          )}
          <button
            onClick={openForm}
            className="text-xs font-bold px-2 py-0.5 rounded-lg hover:opacity-70 transition-opacity"
            style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
          >
            + Add
          </button>
          <span className="text-gray-400 text-sm">{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {isOpen && (
        <div className="bg-white flex flex-col divide-y divide-gray-50">
          {topic.outcomes.length === 0 && !addingOutcome && (
            <p className="text-xs text-gray-400 italic px-5 py-3">No outcomes yet.</p>
          )}
          {topic.outcomes.map((outcome) => (
            <OutcomeRow
              key={outcome.id}
              outcome={outcome}
              editingOutcomes={editingOutcomes}
              onDelete={() => onDeleteOutcome(outcome.id)}
              isDeleting={deletingId === outcome.id}
            />
          ))}
          {addingOutcome && (
            <div className="flex items-center gap-2 px-5 py-2.5">
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

export default function OutcomesPanel({
  courseId,
  topics,
  onRefresh,
}: {
  courseId: string;
  topics: TopicWithOutcomes[];
  onRefresh: () => Promise<void>;
}) {
  const [openTopics, setOpenTopics] = useState<Set<string>>(
    () => new Set(topics.length > 0 ? [topics[0].id] : [])
  );
  const [editingOutcomes, setEditingOutcomes] = useState(false);
  const [addingTopic, setAddingTopic] = useState(false);
  const [draftTopicName, setDraftTopicName] = useState("");
  const [savingTopic, setSavingTopic] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingTopic) topicInputRef.current?.focus();
  }, [addingTopic]);

  // Keep openTopics in sync when topics list changes (e.g. on initial load)
  useEffect(() => {
    setOpenTopics((prev) => {
      if (prev.size > 0) return prev;
      return topics.length > 0 ? new Set([topics[0].id]) : prev;
    });
  }, [topics]);

  function toggleTopic(id: string) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    setSavingTopic(false);
    if (!res.ok) { setError("Failed to add topic — please try again."); return; }
    setDraftTopicName("");
    setAddingTopic(false);
    await onRefresh();
  }

  async function handleAddOutcome(topicId: string, name: string) {
    const res = await fetch(`/api/courses/${courseId}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, topicId }),
    });
    if (!res.ok) { setError("Failed to add outcome — please try again."); return; }
    await onRefresh();
  }

  async function handleDeleteTopic(topicId: string) {
    setDeletingId(topicId);
    const res = await fetch(`/api/courses/${courseId}/topics/${topicId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) { setError("Failed to delete topic — please try again."); return; }
    await onRefresh();
  }

  async function handleDeleteOutcome(outcomeId: string) {
    setDeletingId(outcomeId);
    const res = await fetch(`/api/courses/${courseId}/outcomes/${outcomeId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) { setError("Failed to delete outcome — please try again."); return; }
    await onRefresh();
  }

  const allOutcomes = topics.flatMap((t) => t.outcomes);

  return (
    <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: "#FEFEE8" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-gray-800">Learning Outcomes</h2>
          <p className="text-xs text-gray-500">
            {allOutcomes.length} outcome{allOutcomes.length !== 1 ? "s" : ""}
            {topics.length > 0
              ? ` across ${topics.length} topic${topics.length !== 1 ? "s" : ""}`
              : ""}
          </p>
          <button
            onClick={() => setEditingOutcomes((v) => !v)}
            className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
            style={{
              backgroundColor: editingOutcomes ? "#F5C842" : "#e5e7eb",
              color: editingOutcomes ? "#1f2937" : "#6b7280",
            }}
          >
            {editingOutcomes ? "Done" : "Edit"}
          </button>
        </div>
        <button
          onClick={() => setAddingTopic(true)}
          className="px-3 py-1.5 rounded-full text-xs font-bold text-gray-800 shadow hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "#F5C842" }}
        >
          + Add Topic
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
      )}

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

      {topics.length > 0 && (
        <div className="flex flex-col gap-3">
          {topics.map((topic, idx) => (
            <TopicAccordionCard
              key={topic.id}
              topic={topic}
              index={idx}
              isOpen={openTopics.has(topic.id)}
              onToggle={() => toggleTopic(topic.id)}
              onAddOutcome={handleAddOutcome}
              editingOutcomes={editingOutcomes}
              onDeleteTopic={() => handleDeleteTopic(topic.id)}
              onDeleteOutcome={handleDeleteOutcome}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}

      {topics.length === 0 && allOutcomes.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          No outcomes yet — add a topic to get started.
        </p>
      )}
    </div>
  );
}
