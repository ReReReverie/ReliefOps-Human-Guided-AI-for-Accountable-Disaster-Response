"use client";

import { useEffect, useRef } from "react";
import type {
  ReporterHistoryItem,
} from "@/features/reporter/types";
import type { ReporterWorkspaceStatus } from "@/features/reporter/useReporterWorkspace";

type Props = {
  status: ReporterWorkspaceStatus;
  expiresAt: string | null;
  items: ReporterHistoryItem[];
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
  selectedCaseId: string | null;
  transcriptLoading: boolean;
  transcriptError: string | null;
  mobileOpen: boolean;
  onOpenMobile: () => void;
  onCloseMobile: () => void;
  onSelect: (caseId: string) => void;
  onNewChat: () => boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
};

const statusPresentation: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  INTAKE: { icon: "◌", label: "Intake", color: "#e0a94a" },
  REVIEW: { icon: "◒", label: "In review", color: "#6aabde" },
  ACTIVE: { icon: "●", label: "Active", color: "#4caf7d" },
  CLOSED: { icon: "✓", label: "Closed", color: "#8e9aac" },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";

  const now = Date.now();
  const age = Math.max(0, now - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (age < minute) return "Just now";
  if (age < hour) return `${Math.floor(age / minute)}m ago`;
  if (age < day) return `${Math.floor(age / hour)}h ago`;
  if (age < 7 * day) return `${Math.floor(age / day)}d ago`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatExpiry(value: string | null): string | null {
  if (!value) return null;
  const remaining = Date.parse(value) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor(
    (remaining % (60 * 60 * 1000)) / (60 * 1000)
  );
  if (hours > 0) {
    return minutes > 0
      ? `${hours}h ${minutes}m remaining`
      : `${hours}h remaining`;
  }
  return `${Math.max(1, minutes)}m remaining`;
}

function getStatus(status: string) {
  return statusPresentation[status] ?? {
    icon: "•",
    label: status.replace(/_/g, " "),
    color: "#8e9aac",
  };
}

function HistoryList({
  status,
  expiresAt,
  items,
  nextCursor,
  loading,
  error,
  selectedCaseId,
  transcriptLoading,
  transcriptError,
  onSelect,
  onNewChat,
  onRefresh,
  onLoadMore,
  onCloseMobile,
  compact = false,
}: Props & { compact?: boolean }) {
  const expiryLabel = formatExpiry(expiresAt);

  function handleNewChat() {
    if (onNewChat()) onCloseMobile();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex-none border-b px-4 py-4"
        style={{ borderColor: "#253546" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "#6aabde" }}
            >
              Reporter workspace
            </p>
            <h2 className="mt-1 text-sm font-semibold text-white">
              Previous reports
            </h2>
          </div>

          {compact && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="min-h-11 rounded-md px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-[#253546] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6aabde]"
              aria-label="Close report history"
            >
              Close
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b5278] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec7f4]"
          style={{ background: "#1b3145", borderColor: "#355777" }}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {status === "initializing" && (
          <div
            className="space-y-2 px-2"
            aria-label="Loading report history"
            role="status"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[76px] animate-pulse rounded-lg"
                style={{ background: "#1b2937" }}
              />
            ))}
          </div>
        )}

        {status === "expired" && (
          <div className="px-3 py-4 text-sm" role="status">
            <p className="font-semibold text-white">History expired</p>
            <p className="mt-1 leading-relaxed" style={{ color: "#aab7c5" }}>
              This browser workspace is no longer available. Start a new report
              to continue.
            </p>
          </div>
        )}

        {status === "unavailable" && (
          <div className="px-3 py-4 text-sm" role="alert">
            <p className="font-semibold text-white">History unavailable</p>
            <p className="mt-1 leading-relaxed" style={{ color: "#aab7c5" }}>
              Your current chat is still available. Previous reports could not
              be loaded in this session.
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 min-h-11 rounded-md px-3 py-2 text-sm font-semibold text-[#8ec7f4] hover:bg-[#1b2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec7f4]"
            >
              Retry history
            </button>
          </div>
        )}

        {status === "ready" && error && (
          <div className="mx-2 mb-3 rounded-lg border px-3 py-3 text-sm" role="alert" style={{ background: "#2d1515", borderColor: "#4d2020", color: "#f7a0a0" }}>
            <p>{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-2 min-h-11 rounded-md px-2 py-1 font-semibold text-[#f7c0c0] hover:bg-[#4d2020] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7a0a0]"
            >
              Retry
            </button>
          </div>
        )}

        {status === "ready" && loading && items.length === 0 && !error && (
          <div
            className="space-y-2 px-2"
            aria-label="Loading report history"
            role="status"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[76px] animate-pulse rounded-lg"
                style={{ background: "#1b2937" }}
              />
            ))}
          </div>
        )}

        {status === "ready" && !loading && !error && items.length === 0 && (
          <div className="px-3 py-5 text-sm" role="status">
            <p className="font-semibold text-white">No previous reports</p>
            <p className="mt-1 leading-relaxed" style={{ color: "#aab7c5" }}>
              Your authorized conversations will appear here after the first
              message is sent.
            </p>
          </div>
        )}

        {status === "ready" && items.length > 0 && (
          <div className="space-y-1" aria-label="Authorized previous reports">
            {items.map((item) => {
              const itemStatus = getStatus(item.status);
              const active = selectedCaseId === item.caseId;
              const pending = transcriptLoading && active;

              return (
                <button
                  key={item.caseId}
                  type="button"
                  onClick={() => onSelect(item.caseId)}
                  aria-current={active ? "true" : undefined}
                  aria-label={`${item.publicRef}, ${itemStatus.label}, ${item.messageCount} messages, last active ${formatDate(item.lastActivityAt)}`}
                  className="min-h-[76px] w-full rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec7f4]"
                  style={{
                    background: active ? "#1b3145" : "transparent",
                    borderColor: active ? "#355777" : "transparent",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-white">
                      {item.publicRef}
                    </span>
                    <span
                      className="flex-none text-[11px]"
                      style={{ color: "#8e9aac" }}
                    >
                      {formatDate(item.lastActivityAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span aria-hidden="true" style={{ color: itemStatus.color }}>
                      {itemStatus.icon}
                    </span>
                    <span style={{ color: itemStatus.color }}>
                      {itemStatus.label}
                    </span>
                    <span style={{ color: "#66788b" }} aria-hidden="true">
                      ·
                    </span>
                    <span style={{ color: "#aab7c5" }}>
                      {item.messageCount} {item.messageCount === 1 ? "message" : "messages"}
                    </span>
                    {pending && (
                      <span className="ml-auto" style={{ color: "#8ec7f4" }}>
                        Loading…
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: "#73869a" }}>
                    {item.chatMode === "HUMAN" ? "Human coordinator" : "AI assistant"}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {status === "ready" && nextCursor && !loading && (
          <button
            type="button"
            onClick={onLoadMore}
            className="mt-3 min-h-11 w-full rounded-md px-3 py-2 text-sm font-semibold text-[#8ec7f4] hover:bg-[#1b2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec7f4]"
          >
            Load older reports
          </button>
        )}

        {status === "ready" && loading && items.length > 0 && (
          <div className="px-3 py-4 text-center text-xs" role="status" style={{ color: "#8e9aac" }}>
            Updating history…
          </div>
        )}

        {transcriptError && selectedCaseId && (
          <div className="mx-2 mt-3 rounded-lg border px-3 py-3 text-xs" role="alert" style={{ background: "#2d1515", borderColor: "#4d2020", color: "#f7a0a0" }}>
            {transcriptError}
          </div>
        )}
      </div>

      <div
        className="flex-none border-t px-4 py-3 text-[11px]"
        style={{ borderColor: "#253546", color: "#73869a" }}
      >
        <div className="flex items-center justify-between gap-2">
          <span>{expiryLabel ? `Access ${expiryLabel}` : "Browser-only access"}</span>
          {status === "ready" && (
            <button
              type="button"
              onClick={onRefresh}
              className="min-h-11 rounded-md px-2 py-1 font-semibold text-[#8ec7f4] hover:bg-[#1b2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec7f4]"
              aria-label="Refresh report history"
              title="Refresh report history"
            >
              Refresh
            </button>
          )}
        </div>
        <p className="mt-1 leading-relaxed">
          Only conversations authorized for this browser are shown.
        </p>
      </div>
    </div>
  );
}

export function ReporterHistory({
  status,
  expiresAt,
  items,
  nextCursor,
  loading,
  error,
  selectedCaseId,
  transcriptLoading,
  transcriptError,
  mobileOpen,
  onOpenMobile,
  onCloseMobile,
  onSelect,
  onNewChat,
  onRefresh,
  onLoadMore,
}: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    drawerRef.current
      ?.querySelector<HTMLElement>("button:not([disabled])")
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseMobile();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])"
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Desktop history rail. It is an outer shell and never changes the chat feed. */}
      <aside
        aria-label="Previous report history"
        className="hidden h-full w-[280px] flex-none lg:flex"
        style={{ background: "#101923", borderRight: "1px solid #253546" }}
      >
        <HistoryList
          status={status}
          expiresAt={expiresAt}
          items={items}
          nextCursor={nextCursor}
          loading={loading}
          error={error}
          selectedCaseId={selectedCaseId}
          transcriptLoading={transcriptLoading}
          transcriptError={transcriptError}
          mobileOpen={mobileOpen}
          onOpenMobile={onOpenMobile}
          onCloseMobile={onCloseMobile}
          onSelect={onSelect}
          onNewChat={onNewChat}
          onRefresh={onRefresh}
          onLoadMore={onLoadMore}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={false}>
          <button
            type="button"
            onClick={onCloseMobile}
            className="absolute inset-0 h-full w-full bg-black/60"
            aria-label="Close report history"
          />
          <div
            id="reporter-history-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reporter-history-title"
            className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] max-w-full flex-col shadow-2xl"
            style={{ background: "#101923", borderRight: "1px solid #355777" }}
          >
            <div className="sr-only" id="reporter-history-title">
              Previous report history
            </div>
            <HistoryList
              status={status}
              expiresAt={expiresAt}
              items={items}
              nextCursor={nextCursor}
              loading={loading}
              error={error}
              selectedCaseId={selectedCaseId}
              transcriptLoading={transcriptLoading}
              transcriptError={transcriptError}
              mobileOpen={mobileOpen}
              onOpenMobile={onOpenMobile}
              onCloseMobile={onCloseMobile}
              onSelect={onSelect}
              onNewChat={onNewChat}
              onRefresh={onRefresh}
              onLoadMore={onLoadMore}
              compact
            />
          </div>
        </div>
      )}
    </>
  );
}
