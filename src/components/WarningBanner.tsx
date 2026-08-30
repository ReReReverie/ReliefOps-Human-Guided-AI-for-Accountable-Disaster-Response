/**
 * WarningBanner — non-negotiable per Phase 1 requirements.
 * Displayed in the shared root layout on every page.
 */
export function WarningBanner() {
  return (
    <div
      role="alert"
      className="flex w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-950 sm:text-sm"
    >
      <span aria-hidden="true" className="text-amber-700">⚠</span>
      <strong>Prototype — Synthetic Demonstration Data Only.</strong>
      <span>This system uses entirely synthetic data and is</span>
      <strong>not an emergency service</strong>.
      <span>Do not submit real personal information or use this system in any real emergency.</span>
    </div>
  );
}
