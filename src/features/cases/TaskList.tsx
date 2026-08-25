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
    <div className={`border rounded p-3 space-y-2 ${task.approved ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-start gap-3">
        {/* Approve checkbox */}
        <label className="flex items-center gap-1.5 mt-0.5">
          <input
            type="checkbox"
            checked={task.approved}
            disabled={task.approved || isPending}
            onChange={handleApprove}
            className="accent-green-600"
            title={task.approved ? "Approved" : "Approve task"}
          />
          <span className="text-xs text-gray-500">
            {task.approved ? "Approved" : "Approve"}
          </span>
        </label>

        {/* Status selector */}
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          disabled={isPending}
          className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={120}
              className="w-full text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
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
                  onClick={handleSaveEdit}
                  disabled={isPending}
                  className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs px-2 py-0.5 border border-gray-300 rounded"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50"
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
          <input
            value={editDetails}
            onChange={(e) => setEditDetails(e.target.value)}
            maxLength={500}
            placeholder="Details (optional)"
            className="w-full text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <input
            value={editOwner}
            onChange={(e) => setEditOwner(e.target.value)}
            placeholder="Proposed owner (optional)"
            className="w-full text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
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

      {error && <p className="text-xs text-red-600 pl-12">{error}</p>}
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
        <div className="border border-dashed border-gray-300 rounded p-3 space-y-2">
          <p className="text-sm font-medium text-gray-700">Add Task</p>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={120}
            placeholder="Task title (required)"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <input
            value={newDetails}
            onChange={(e) => setNewDetails(e.target.value)}
            maxLength={500}
            placeholder="Details (optional)"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <input
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            placeholder="Proposed owner (optional)"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAddTask}
              disabled={isPending || !newTitle.trim()}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add Task"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add task
        </button>
      )}
    </div>
  );
}
