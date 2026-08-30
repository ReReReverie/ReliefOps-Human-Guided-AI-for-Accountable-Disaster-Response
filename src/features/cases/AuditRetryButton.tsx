"use client";

/**
 * AuditRetryButton — coordinator-only button to retry a PENDING or FAILED
 * Stellar anchor submission.
 *
 * Calls POST /api/audit/[auditId]/retry and refreshes the page on success.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";

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
    <div className="mt-2 space-y-2">
      <Button
        type="button"
        onClick={handleRetry}
        disabled={loading}
        size="sm"
        variant="warning"
      >
        {loading ? "Retrying…" : "Retry Stellar Anchor"}
      </Button>
      {error && <Alert tone="danger" role="alert" className="px-2 py-1 text-xs">{error}</Alert>}
    </div>
  );
}
