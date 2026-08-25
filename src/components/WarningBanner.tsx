/**
 * WarningBanner — non-negotiable per Phase 1 requirements.
 * Displayed in the shared root layout on every page.
 */
export function WarningBanner() {
  return (
    <div
      role="alert"
      className="w-full bg-amber-100 border-b border-amber-400 text-amber-900 text-sm text-center px-4 py-2 flex flex-wrap items-center justify-center gap-x-1"
    >
      <strong>⚠ Prototype — Synthetic Demonstration Data Only.</strong>
      <span>This system uses entirely synthetic data and is</span>
      <strong>not an emergency service</strong>.
      <span>Do not submit real personal information or use this system in any real emergency.</span>
    </div>
  );
}
