"use client";

/**
 * AuditRetryButton — coordinator-only button to retry a PENDING or FAILED
 * Stellar anchor submission.
 *
 * Calls POST /api/audit/[auditId]/retry and refreshes the page on success.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuditRetryButton({ auditId }: { auditId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit/${auditId}/retry`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Retry failed");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error during retry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1 space-y-1">
      <button
        onClick={handleRetry}
        disabled={loading}
        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Retrying…" : "Retry Stellar Anchor"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
