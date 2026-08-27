/**
 * src/app/login/loading.tsx — Skeleton shown while the login page loads.
 * Matches the centred card layout of the real login form.
 */
export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-8 space-y-5">
        {/* Title */}
        <div className="h-6 w-44 bg-gray-200 rounded animate-pulse" />
        {/* Subtitle */}
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />

        {/* Email field */}
        <div className="space-y-1">
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-full bg-gray-100 border border-gray-200 rounded animate-pulse" />
        </div>

        {/* Password field */}
        <div className="space-y-1">
          <div className="h-4 w-18 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-full bg-gray-100 border border-gray-200 rounded animate-pulse" />
        </div>

        {/* Submit button */}
        <div className="h-9 w-full bg-blue-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
