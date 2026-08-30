"use client";
/**
 * src/features/cases/TaskList.tsx — Task checklist client component.
 *
 * Renders each task with:
 *   - Status selector (TODO / DOING / DONE)
 *   - Title, details, proposedOwner display + edit form (unapproved only)
 *   - Approve checkbox
 * Plus an "Add Task" form.
 *
 * Guards are enforced server-side in actions.ts; client shows errors when thrown.
 */
import { useTransition, useState } from "react";
import {
  approveTask,
  updateTaskStatus,
  saveTask,
  addTask,
  type TaskStatus,
} from "./actions";
import { Button } from "@/components/ui";

type Task = {
  id: string;
  title: string;
  details: string | null;
  position: number;
  proposedOwner: string | null;
  status: string;
  approved: boolean;
};

type Props = {
  caseId: string;
  tasks: Task[];
};

const STATUS_OPTIONS: TaskStatus[] = ["TODO", "DOING", "DONE"];

function TaskRow({ task }: { task: Task; caseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDetails, setEditDetails] = useState(task.details ?? "");
  const [editOwner, setEditOwner] = useState(task.proposedOwner ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleStatusChange(status: TaskStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTaskStatus(task.id, status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status update failed.");
      }
    });
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveTask(task.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed.");
      }
    });
  }

  function handleSaveEdit() {
    setError(null);
    startTransition(async () => {
      try {
        await saveTask(task.id, {
          title: editTitle,
          details: editDetails || undefined,
          proposedOwner: editOwner || undefined,
        });
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  return (
    <div className={`space-y-3 rounded-xl border p-4 ${task.approved ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        {/* Approve checkbox */}
          <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.approved}
            disabled={task.approved || isPending}
            onChange={handleApprove}
            className="h-4 w-4 accent-emerald-700"
            title={task.approved ? "Approved" : "Approve task"}
          />
          <span className="text-xs text-slate-600">
            {task.approved ? "Approved" : "Approve"}
          </span>
        </label>

        {/* Status selector */}
        <label htmlFor={`task-status-${task.id}`} className="sr-only">
          Status for {task.title}
        </label>
        <select
          id={`task-status-${task.id}`}
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          disabled={isPending}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <>
              <label htmlFor={`task-title-${task.id}`} className="sr-only">Title for {task.title}</label>
              <input
                id={`task-title-${task.id}`}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={120}
                className="min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </>
          ) : (
            <span className="text-sm font-medium text-gray-900 break-words">
              {task.title}
            </span>
          )}
        </div>

        {/* Edit / Save controls (unapproved only) */}
        {!task.approved && (
          <div className="flex gap-1.5 flex-shrink-0">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isPending}
                  className="min-h-10 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Details and owner — editable */}
      {editing ? (
        <div className="pl-12 space-y-1.5">
          <label htmlFor={`task-details-${task.id}`} className="sr-only">Details for {task.title}</label>
          <input
            id={`task-details-${task.id}`}
            value={editDetails}
            onChange={(e) => setEditDetails(e.target.value)}
            maxLength={500}
            placeholder="Details (optional)"
            className="min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          <label htmlFor={`task-owner-${task.id}`} className="sr-only">Proposed owner for {task.title}</label>
          <input
            id={`task-owner-${task.id}`}
            value={editOwner}
            onChange={(e) => setEditOwner(e.target.value)}
            placeholder="Proposed owner (optional)"
            className="min-h-10 w-full rounded-lg border border-slate-300 px-2 text-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </div>
      ) : (
        <div className="pl-12 space-y-0.5">
          {task.details && (
            <p className="text-xs text-gray-600">{task.details}</p>
          )}
          {task.proposedOwner && (
            <p className="text-xs text-gray-500">
              Owner: {task.proposedOwner}
            </p>
          )}
        </div>
      )}

      {error && <p role="alert" className="pl-12 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function TaskList({ caseId, tasks }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const sorted = [...tasks].sort((a, b) => a.position - b.position);

  function handleAddTask() {
    setAddError(null);
    startTransition(async () => {
      try {
        await addTask(caseId, {
          title: newTitle,
          details: newDetails || undefined,
          proposedOwner: newOwner || undefined,
        });
        setNewTitle("");
        setNewDetails("");
        setNewOwner("");
        setShowAddForm(false);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Add failed.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No tasks yet.</p>
      ) : (
        sorted.map((t) => <TaskRow key={t.id} task={t} caseId={caseId} />)
      )}

      {showAddForm ? (
        <div role="group" aria-labelledby={`add-task-title-${caseId}`} className="border border-dashed border-gray-300 rounded p-3 space-y-2">
        <p id={`add-task-title-${caseId}`} className="text-sm font-semibold text-slate-800">Add Task</p>
          <label htmlFor={`new-task-title-${caseId}`} className="sr-only">Task title</label>
          <input
            id={`new-task-title-${caseId}`}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={120}
            placeholder="Task title (required)"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          <label htmlFor={`new-task-details-${caseId}`} className="sr-only">Task details</label>
          <input
            id={`new-task-details-${caseId}`}
            value={newDetails}
            onChange={(e) => setNewDetails(e.target.value)}
            maxLength={500}
            placeholder="Details (optional)"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          <label htmlFor={`new-task-owner-${caseId}`} className="sr-only">Proposed owner</label>
          <input
            id={`new-task-owner-${caseId}`}
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            placeholder="Proposed owner (optional)"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          {addError && <p role="alert" className="text-sm text-red-700">{addError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAddTask}
              disabled={isPending || !newTitle.trim()}
              size="sm"
            >
              {isPending ? "Adding…" : "Add Task"}
            </Button>
            <Button
              type="button"
              onClick={() => setShowAddForm(false)}
              size="sm"
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setShowAddForm(true)}
          variant="subtle"
          size="sm"
          className="px-0 text-blue-700 hover:bg-transparent hover:underline"
        >
          + Add task
        </Button>
      )}
    </div>
  );
}
