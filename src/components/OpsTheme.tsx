"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const OPS_THEME_STORAGE_KEY = "reliefops-ops-theme";
export type OpsTheme = "emergency-light" | "emergency-dark";

function isOpsTheme(value: string | null): value is OpsTheme {
  return value === "emergency-light" || value === "emergency-dark";
}

function readStoredTheme(): OpsTheme | null {
  try {
    const stored = window.localStorage.getItem(OPS_THEME_STORAGE_KEY);
    return isOpsTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: OpsTheme, root: HTMLElement) {
  root.dataset.theme = theme;
  document.documentElement.dataset.opsTheme = theme;
}

/**
 * Runs inside the ops layout and cleans the document marker when leaving the
 * coordinator area. The marker lets the shared header follow the same theme
 * without applying the preference to public/reporter pages.
 */
export function OpsThemeBridge() {
  useEffect(() => {
    const root = document.getElementById("ops-root");
    if (!root) return;
    const current = root.dataset.theme ?? null;
    const theme = readStoredTheme() ?? (isOpsTheme(current) ? current : "emergency-light");
    applyTheme(theme, root);
    return () => {
      delete document.documentElement.dataset.opsTheme;
    };
  }, []);

  return null;
}

export function OpsThemeToggle() {
  const [theme, setTheme] = useState<OpsTheme>("emergency-light");

  useEffect(() => {
    const root = document.getElementById("ops-root");
    if (!root) return;
    const current = root.dataset.theme ?? null;
    const theme = readStoredTheme() ?? (isOpsTheme(current) ? current : "emergency-light");
    applyTheme(theme, root);
    setTheme(theme);
  }, []);

  function toggleTheme() {
    const next: OpsTheme = theme === "emergency-dark" ? "emergency-light" : "emergency-dark";
    const root = document.getElementById("ops-root");
    if (root) applyTheme(next, root);
    else document.documentElement.dataset.opsTheme = next;
    try {
      window.localStorage.setItem(OPS_THEME_STORAGE_KEY, next);
    } catch {
      // A blocked storage context should not prevent theme switching in-session.
    }
    setTheme(next);
  }

  const dark = theme === "emergency-dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      title={dark ? "Use light theme" : "Use dark theme"}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ops-theme-toggle motion-reduce:transition-none"
    >
      {dark ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
