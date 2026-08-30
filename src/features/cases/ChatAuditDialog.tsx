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
import { Alert, Badge, Button, Skeleton, StatusBadge } from "@/components/ui";

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function fmtTimestamp(iso: string | null): { local: string; utc: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
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
  const requestIdRef = useRef(0);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Return focus to trigger
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  // ── fetch verification data ──────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!auditId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/audit/${auditId}/verify`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (requestId === requestIdRef.current) {
          setLoadError((body as { error?: string }).error ?? "Failed to load audit data.");
        }
        return;
      }
      const nextData = (await res.json()) as ChatAuditVerificationDto;
      if (requestId === requestIdRef.current) setData(nextData);
    } catch {
      if (requestId === requestIdRef.current) {
        setLoadError("Network error loading audit data.");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [auditId]);

  // A shared header instance survives client navigation between case pages.
  // Clear the previous case's audit payload before the next dialog can open.
  useEffect(() => {
    ++requestIdRef.current;
    setOpen(false);
    setData(null);
    setLoadError(null);
    setLoading(false);
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
  }, [open, handleClose]);

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

  async function handleRetry() {
    if (!auditId) return;
    startRetryTransition(async () => {
      try {
        const response = await fetch(`/api/audit/${auditId}/retry`, { method: "POST" });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setLoadError((body as { error?: string }).error ?? "Retry request failed.");
          return;
        }
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
        <span className="ops-audit-placeholder inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 sm:min-w-40">
          Chat Audit
        </span>
      );
    }
    return (
      <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500">
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
        type="button"
        onClick={handleOpen}
        className={
          asNavButton
            ? "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-blue-800 hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-w-40 motion-reduce:transition-none"
            : "inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Chat Audit Record"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-bold text-slate-950">
                Chat Audit Record
              </h2>
              <button
                ref={closeButtonRef}
                onClick={handleClose}
                aria-label="Close dialog"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-5 text-sm">

              {/* Loading */}
              {loading && (
                <div role="status" className="flex items-center gap-2 text-slate-600">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  Loading verification data…
                </div>
              )}

              {/* Error */}
              {loadError && !loading && (
                <Alert tone="danger" role="alert">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={load}
                    className="ml-3 min-h-9 font-semibold underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    Retry
                  </button>
                </Alert>
              )}

              {/* Loaded */}
              {data && !loading && (
                <>
                  {/* Status row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">DB</Badge><StatusBadge status={data.dbStatus} />
                    <Badge tone="neutral">Stellar</Badge><StatusBadge status={data.verificationStatus} />
                  </div>

                  {/* Chat start time */}
                  {data.chatStartedAt && (() => {
                    const ts = fmtTimestamp(data.chatStartedAt);
                    return ts ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Chat Start Time</p>
                        <p className="text-slate-800">{ts.local}</p>
                        <p className="font-mono text-xs text-slate-500">{ts.utc}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Anchored at */}
                  {data.anchoredAt && (() => {
                    const ts = fmtTimestamp(data.anchoredAt);
                    return ts ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Anchored At</p>
                        <p className="text-slate-800">{ts.local}</p>
                        <p className="font-mono text-xs text-slate-500">{ts.utc}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Ledger close time */}
                  {data.ledgerCloseTime && (() => {
                    const ts = fmtTimestamp(data.ledgerCloseTime);
                    return ts ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ledger Closed At</p>
                        <p className="text-slate-800">{ts.local}</p>
                        <p className="font-mono text-xs text-slate-500">{ts.utc}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Stored hash */}
                  {data.storedHash && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Record Hash</p>
                      <p className="break-all font-mono text-xs text-slate-700">{data.storedHash}</p>
                    </div>
                  )}

                  {/* Audit ID */}
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Audit ID</p>
                    <p className="break-all font-mono text-xs text-slate-700">{data.auditId}</p>
                  </div>

                  {/* Stellar TX link */}
                  {data.stellarTxHash && data.stellarExplorerUrl && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Stellar Transaction</p>
                      <a
                        href={data.stellarExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-mono text-xs text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        {data.stellarTxHash}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={load}
                  disabled={loading || retryPending}
                  size="sm"
                  variant="secondary"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </Button>
                {canRetry && (
                  <Button
                    type="button"
                    onClick={handleRetry}
                    disabled={loading || retryPending}
                    size="sm"
                    variant="warning"
                  >
                    {retryPending ? "Retrying…" : "Retry Stellar Anchor"}
                  </Button>
                )}
              </div>
              <Button
                type="button"
                onClick={handleClose}
                size="sm"
                variant="subtle"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
