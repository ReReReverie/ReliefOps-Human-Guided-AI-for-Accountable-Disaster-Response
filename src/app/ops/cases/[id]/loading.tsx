/**
 * src/app/ops/cases/[id]/loading.tsx — Skeleton shown while the case
 * detail page loads. Mirrors the section layout of the real page.
 */

function SkeletonLine({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={`h-4 ${wide ? "w-full" : "w-2/3"} bg-gray-200 rounded animate-pulse`}
    />
  );
}

function SkeletonSection({ rows = 3, title }: { rows?: number; title?: boolean }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      {title && (
        <div className="h-5 w-32 bg-gray-300 rounded animate-pulse mb-4" />
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} wide={i % 2 === 0} />
      ))}
    </div>
  );
}

export default function CaseDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          {/* ← Case Queue link */}
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          {/* Case ref title */}
          <div className="h-6 w-56 bg-gray-300 rounded animate-pulse" />
          {/* Status + chat mode */}
          <div className="h-4 w-44 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Controls buttons */}
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Chat section */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="h-5 w-12 bg-gray-300 rounded animate-pulse" />

        {/* Message bubbles */}
        <div className="space-y-3 max-h-96 overflow-hidden">
          <div className="flex flex-col items-start gap-1">
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-64 bg-gray-100 border border-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-3 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-blue-200 rounded animate-pulse" />
          </div>
          <div className="flex flex-col items-start gap-1">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-16 w-72 bg-gray-100 border border-gray-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Chat control buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <div className="h-8 w-28 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Facts + AI urgency section */}
      <SkeletonSection rows={4} title />

      {/* Human urgency form section */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="h-5 w-40 bg-gray-300 rounded animate-pulse" />
        <div className="h-9 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-9 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-8 w-28 bg-blue-200 rounded animate-pulse" />
      </div>

      {/* Tasks section */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="h-5 w-16 bg-gray-300 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-7 w-16 bg-gray-200 rounded animate-pulse ml-4" />
          </div>
        ))}
      </div>

      {/* Audit section */}
      <SkeletonSection rows={2} title />
    </div>
  );
}
