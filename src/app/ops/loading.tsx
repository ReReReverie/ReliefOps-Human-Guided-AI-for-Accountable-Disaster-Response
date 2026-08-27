/**
 * src/app/ops/loading.tsx — Skeleton shown while the case queue loads.
 * Mirrors the table layout of the real ops page.
 */
function SkeletonRow() {
  return (
    <tr>
      {/* Reference */}
      <td className="px-4 py-3">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      </td>
      {/* Status badge */}
      <td className="px-4 py-3">
        <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
      </td>
      {/* AI Suggested Urgency */}
      <td className="px-4 py-3">
        <div className="h-4 w-14 bg-gray-200 rounded animate-pulse" />
      </td>
      {/* Human Final Urgency */}
      <td className="px-4 py-3">
        <div className="h-4 w-14 bg-gray-100 rounded animate-pulse" />
      </td>
      {/* Override */}
      <td className="px-4 py-3">
        <div className="h-7 w-7 bg-orange-100 rounded animate-pulse" />
      </td>
      {/* Age */}
      <td className="px-4 py-3">
        <div className="h-4 w-12 bg-gray-100 rounded animate-pulse" />
      </td>
    </tr>
  );
}

export default function OpsLoading() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="h-6 w-28 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Reference", "Status", "AI Suggested Urgency", "Human Final Urgency", "Override", "Age"].map(
                (col) => (
                  <th key={col} className="px-4 py-3 text-left">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    </div>
  );
}
