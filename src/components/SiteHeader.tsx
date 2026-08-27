"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    // Verification is the public follow-up to a submitted incident.
    isActive: (pathname) =>
      pathname === "/report" || pathname === "/verify" || pathname.startsWith("/verify/"),
  },
  {
    href: "/ops",
    label: "Operator Dashboard",
    // Keep nested case pages in the dashboard section.
    isActive: (pathname) => pathname === "/ops" || pathname.startsWith("/ops/"),
  },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight text-gray-900">
            ReliefOps
          </p>
          <p className="text-xs text-gray-500">Human-supervised coordination demo</p>
        </div>

        <nav
          aria-label="Primary navigation"
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto"
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
        </nav>
      </div>
    </header>
  );
}
