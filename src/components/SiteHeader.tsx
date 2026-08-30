"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardCheck,
  LayoutDashboard,
  MessageSquareText,
} from "lucide-react";
import { ChatAuditDialog } from "@/features/cases/ChatAuditDialog";
import { OpsThemeToggle } from "@/components/OpsTheme";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isActive: (pathname: string) => boolean;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: "Demo Home",
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === "/",
  },
  {
    href: "/report",
    label: "Report Incident",
    icon: MessageSquareText,
    isActive: (pathname) =>
      pathname === "/report" || pathname === "/verify" || pathname.startsWith("/verify/"),
  },
  {
    href: "/ops",
    label: "Operator Dashboard",
    icon: ClipboardCheck,
    isActive: (pathname) => pathname === "/ops" || pathname.startsWith("/ops/"),
  },
];

function extractCaseId(pathname: string): string | null {
  const match = pathname.match(/^\/ops\/cases\/([^/]+)$/);
  return match ? match[1] ?? null : null;
}

type AuditMeta = { auditId: string; dbStatus: string } | null;

function useCaseAuditMeta(caseId: string | null): {
  meta: AuditMeta;
  loading: boolean;
} {
  const [meta, setMeta] = useState<AuditMeta>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string, signal: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/audit/case/${id}`, { signal });
      if (!response.ok) return;
      const data = (await response.json()) as {
        auditId?: string;
        auditStatus?: string;
      };
      if (!signal.aborted && data.auditId) {
        setMeta({ auditId: data.auditId, dbStatus: data.auditStatus ?? "PENDING" });
      }
    } catch {
      // The audit shortcut is non-critical to case navigation. Aborted
      // requests are expected when the coordinator changes cases quickly.
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!caseId) {
      setMeta(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setMeta(null);
    void load(caseId, controller.signal);
    return () => controller.abort();
  }, [caseId, load]);

  return { meta, loading };
}

/** Shared public/coordinator header. The measured height keeps /report's
 * Telegram shell viewport calculation correct across responsive breakpoints. */
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const headerRef = useRef<HTMLElement>(null);
  const caseId = extractCaseId(pathname);
  const { meta, loading } = useCaseAuditMeta(caseId);
  const isOps = pathname === "/ops" || pathname.startsWith("/ops/");

  useEffect(() => {
    const element = headerRef.current;
    if (!element) return;
    const publishHeight = () => {
      document.documentElement.style.setProperty("--site-header-h", `${element.offsetHeight}px`);
    };
    publishHeight();
    const resizeObserver = new ResizeObserver(publishHeight);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  const showAuditButton = Boolean(caseId);

  return (
    <header
      ref={headerRef}
      className="ops-header-scope border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:py-4">
        <Link
          href="/"
          className="group inline-flex min-h-11 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold tracking-tight text-white shadow-sm"
          >
            RO
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold tracking-tight text-slate-950 group-hover:text-blue-700">
              ReliefOps
            </span>
            <span className="ops-brand-muted block text-xs text-slate-500">
              Human-supervised coordination demo
            </span>
          </span>
        </Link>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <nav
            aria-label="Primary navigation"
            className={`grid w-full grid-cols-1 gap-2 ${
              showAuditButton ? "sm:grid-cols-4" : "sm:grid-cols-3"
            } lg:w-auto`}
          >
            {navigationItems.map((item) => {
              const active = item.isActive(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-w-40 motion-reduce:transition-none"
                      : "ops-nav-inactive inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-w-40 motion-reduce:transition-none"
                  }
                >
                  <Icon aria-hidden="true" size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {showAuditButton && (
              <div className="inline-flex min-h-11 items-center justify-center">
                {loading && !meta ? (
                  <span className="ops-brand-muted px-3 text-xs text-slate-400">Loading…</span>
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

          {isOps ? (
            <div className="flex justify-end sm:pl-1">
              <OpsThemeToggle />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
