"use client";
/**
 * src/features/cases/ChatAuditDialog.tsx — Accessible dialog showing the
 * CHAT_STARTED audit record and Stellar verification result.
 *
 * - Loads verification lazily when dialog opens (does not block page render).
 * - Supports Refresh (re-fetch) and Retry (re-anchor) for PENDING/FAILED.
 * - Keyboard: Esc closes, focus trapped inside.
 * - Never exposes nonce, payload, reporter data, or session information.
 */
import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import type { ChatAuditVerificationDto } from "@/app/api/audit/[auditId]/verify/route";

// ---------------------------------------------------------------------------
// Status colour helpers
// ---------------------------------------------------------------------------

function dbStatusBadge(status: string) {
  if (status === "ANCHORED") return "bg-green-100 text-green-800";
  if (status === "FAILED") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800"; // PENDING
}

function verificationBadge(status: string) {
  if (status === "VERIFIED") return "bg-green-100 text-green-800";
  if (status === "FAILED") return "bg-red-100 text-red-800";
  if (status === "NOT_ANCHORED") return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-600"; // NOT_FOUND
}

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function fmtTimestamp(iso: string | null): { local: string; utc: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return {
      local: d.toLocaleString(),
      utc: d.toUTCString(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  auditId: string | null;
  /** DB anchor status known at page-render time — used to set button label */
  initialDbStatus: string;
  /** When true, styles the trigger to match the site nav bar buttons */
  asNavButton?: boolean;
};

export function ChatAuditDialog({ auditId, initialDbStatus, asNavButton }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChatAuditVerificationDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryPending, startRetryTransition] = useTransition();

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ── fetch verification data ──────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!auditId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/audit/${auditId}/verify`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoadError((body as { error?: string }).error ?? "Failed to load audit data.");
        return;
      }
      setData(await res.json());
    } catch {
      setLoadError("Network error loading audit data.");
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  // Load lazily when dialog opens
  useEffect(() => {
    if (open && !data && !loading) {
      load();
    }
  }, [open, data, loading, load]);

  // Focus close button when dialog opens
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]); // handleClose is stable — defined in the same component scope

  // Trap focus inside dialog
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    function onFocusOut(e: FocusEvent) {
      if (!el!.contains(e.relatedTarget as Node | null)) {
        closeButtonRef.current?.focus();
      }
    }
    el.addEventListener("focusout", onFocusOut);
    return () => el.removeEventListener("focusout", onFocusOut);
  }, [open]);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    // Return focus to trigger
    setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function handleRetry() {
    if (!auditId) return;
    startRetryTransition(async () => {
      try {
        await fetch(`/api/audit/${auditId}/retry`, { method: "POST" });
        // Reload verification after retry
        await load();
      } catch {
        setLoadError("Retry request failed.");
      }
    });
  }

  if (!auditId) {
    if (asNavButton) {
      return (
        <span className="inline-flex min-h-11 items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 sm:min-w-40">
          Chat Audit
        </span>
      );
    }
    return (
      <span className="text-xs text-gray-400 px-3 py-1.5 border border-gray-200 rounded">
        No audit record
      </span>
    );
  }

  const canRetry =
    data?.dbStatus === "PENDING" || data?.dbStatus === "FAILED" ||
    initialDbStatus === "PENDING" || initialDbStatus === "FAILED";

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={
          asNavButton
            ? "inline-flex min-h-11 w-full items-center justify-center rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-indigo-700 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:min-w-40"
            : "text-sm px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        }
        aria-haspopup="dialog"
      >
        Chat Audit
      </button>

      {/* Backdrop + dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          aria-hidden="true"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Chat Audit Record"
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                Chat Audit Record
              </h2>
              <button
                ref={closeButtonRef}
                onClick={handleClose}
                aria-label="Close dialog"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 text-sm">

              {/* Loading */}
              {loading && (
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" aria-hidden="true" />
                  Loading verification data…
                </div>
              )}

              {/* Error */}
              {loadError && !loading && (
                <div role="alert" className="text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {loadError}
                  <button
                    onClick={load}
                    className="ml-3 text-xs underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loaded */}
              {data && !loading && (
                <>
                  {/* Status row */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${dbStatusBadge(data.dbStatus)}`}>
                      DB: {data.dbStatus}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${verificationBadge(data.verificationStatus)}`}>
                      Stellar: {data.verificationStatus}
                    </span>
                  </div>

                  {/* Chat start time */}
                  {data.chatStartedAt && (() => {
                    const ts = fmtTimestamp(data.chatStartedAt);
                    return ts ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chat Start Time</p>
                        <p className="text-gray-800">{ts.local}</p>
                        <p className="text-gray-500 text-xs font-mono">{ts.utc}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Anchored at */}
                  {data.anchoredAt && (() => {
                    const ts = fmtTimestamp(data.anchoredAt);
                    return ts ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Anchored At</p>
                        <p className="text-gray-800">{ts.local}</p>
                        <p className="text-gray-500 text-xs font-mono">{ts.utc}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Ledger close time */}
                  {data.ledgerCloseTime && (() => {
                    const ts = fmtTimestamp(data.ledgerCloseTime);
                    return ts ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ledger Closed At</p>
                        <p className="text-gray-800">{ts.local}</p>
                        <p className="text-gray-500 text-xs font-mono">{ts.utc}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Stored hash */}
                  {data.storedHash && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Record Hash</p>
                      <p className="font-mono text-xs text-gray-700 break-all">{data.storedHash}</p>
                    </div>
                  )}

                  {/* Audit ID */}
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Audit ID</p>
                    <p className="font-mono text-xs text-gray-700 break-all">{data.auditId}</p>
                  </div>

                  {/* Stellar TX link */}
                  {data.stellarTxHash && data.stellarExplorerUrl && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stellar Transaction</p>
                      <a
                        href={data.stellarExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-600 hover:underline break-all"
                      >
                        {data.stellarTxHash}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={load}
                  disabled={loading || retryPending}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
                {canRetry && (
                  <button
                    onClick={handleRetry}
                    disabled={loading || retryPending}
                    className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {retryPending ? "Retrying…" : "Retry Stellar Anchor"}
                  </button>
                )}
              </div>
              <button
                onClick={handleClose}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
