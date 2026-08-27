"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { ChatAuditDialog } from "@/features/cases/ChatAuditDialog";
type NavigationItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: "Demo Home",
    isActive: (pathname) => pathname === "/",
  },
  {
    href: "/report",
    label: "Report Incident",
    isActive: (pathname) =>
      pathname === "/report" || pathname === "/verify" || pathname.startsWith("/verify/"),
  },
  {
    href: "/ops",
    label: "Operator Dashboard",
    isActive: (pathname) => pathname === "/ops" || pathname.startsWith("/ops/"),
  },
];

// ---------------------------------------------------------------------------
// Extract case ID from /ops/cases/[id] pathname
// ---------------------------------------------------------------------------
function extractCaseId(pathname: string): string | null {
  const m = pathname.match(/^\/ops\/cases\/([^/]+)$/);
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Minimal hook: load auditId + dbStatus for a case on demand
// ---------------------------------------------------------------------------
type AuditMeta = { auditId: string; dbStatus: string } | null;

function useCaseAuditMeta(caseId: string | null): {
  meta: AuditMeta;
  loading: boolean;
} {
  const [meta, setMeta] = useState<AuditMeta>(null);
  const [loading, setLoading] = useState(false);
  const lastCaseId = useRef<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit/case/${id}`);
      if (!res.ok) return;
      const data = await res.json() as { auditId?: string; auditStatus?: string };
      if (data.auditId) {
        setMeta({ auditId: data.auditId, dbStatus: data.auditStatus ?? "PENDING" });
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!caseId) { setMeta(null); return; }
    if (caseId === lastCaseId.current) return;
    lastCaseId.current = caseId;
    setMeta(null);
    load(caseId);
  }, [caseId, load]);

  return { meta, loading };
}

// ---------------------------------------------------------------------------
// SiteHeader
// ---------------------------------------------------------------------------

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const headerRef = useRef<HTMLElement>(null);

  const caseId = extractCaseId(pathname);
  const { meta, loading } = useCaseAuditMeta(caseId);

  // Publish --site-header-h for the Telegram chat page
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--site-header-h",
        el.offsetHeight + "px"
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Number of nav columns: 3 always + 1 when Chat Audit is shown
  const showAuditButton = Boolean(caseId);
  const colCount = showAuditButton ? "sm:grid-cols-4" : "sm:grid-cols-3";

  return (
    <header ref={headerRef} className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight text-gray-900">
            ReliefOps
          </p>
          <p className="text-xs text-gray-500">Human-supervised coordination demo</p>
        </div>

        <nav
          aria-label="Primary navigation"
          className={`grid w-full grid-cols-1 gap-2 ${colCount} lg:w-auto`}
        >
          {navigationItems.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-center text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:min-w-40 ${
                  active
                    ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                    : "border-gray-300 bg-white text-gray-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Chat Audit — only shown when on a case detail page */}
          {showAuditButton && (
            <div className="inline-flex min-h-11 items-center justify-center">
              {loading && !meta ? (
                <span className="text-xs text-gray-400 px-3">Loading…</span>
              ) : (
                <ChatAuditDialog
                  auditId={meta?.auditId ?? null}
                  initialDbStatus={meta?.dbStatus ?? "PENDING"}
                  asNavButton
                />
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
