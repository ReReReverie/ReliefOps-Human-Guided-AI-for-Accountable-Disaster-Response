/**
 * src/app/report/loading.tsx — Skeleton shown by Next.js while the
 * report page hydrates. Mirrors the real page layout exactly so there
 * is no layout shift when content arrives.
 */
export default function ReportLoading() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="h-8 w-52 bg-gray-200 rounded animate-pulse mb-4" />

        {/* Warning banner */}
        <div className="border border-amber-200 bg-amber-50 rounded p-3 mb-4">
          <div className="h-4 w-3/4 bg-amber-200 rounded animate-pulse" />
        </div>

        {/* Message list area */}
        <div className="border border-gray-200 rounded mb-4 p-4 space-y-4">
          {/* Incoming message (AI side) */}
          <div className="flex flex-col items-start gap-1">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-72 bg-gray-100 border border-gray-200 rounded animate-pulse" />
          </div>
          {/* Outgoing message (reporter side) */}
          <div className="flex flex-col items-end gap-1">
            <div className="h-3 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-56 bg-blue-200 rounded animate-pulse" />
          </div>
          {/* Another incoming */}
          <div className="flex flex-col items-start gap-1">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-16 w-80 bg-gray-100 border border-gray-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Textarea label */}
        <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mb-1" />
        {/* Textarea */}
        <div className="w-full h-20 border border-gray-200 rounded bg-gray-50 animate-pulse mb-1" />
        {/* char counter */}
        <div className="h-3 w-10 bg-gray-100 rounded animate-pulse ml-auto mb-3" />

        {/* Buttons row */}
        <div className="flex gap-3">
          <div className="h-9 w-16 bg-blue-200 rounded animate-pulse" />
          <div className="h-9 w-36 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Privacy notice */}
        <div className="mt-6 space-y-1">
          <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </main>
  );
}
