/**
 * `/verify/[auditId]` — Public audit verification page.
 *
 * Shows verification result by comparing:
 *   1. Stored DB hash
 *   2. Recomputed hash from stored payload + nonce (server-side only)
 *   3. On-chain Manage Data value from Horizon
 *
 * Public view NEVER exposes: nonce, session token hash, reporter data.
 */
import { verifyAuditRecord } from "@/lib/stellar/verify";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const result = await verifyAuditRecord(auditId);

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Audit Verification</h1>

      {result.status === "NOT_FOUND" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Audit record not found.</p>
          <p className="text-sm text-red-600 mt-1">
            No audit record exists for ID: <span className="font-mono">{auditId}</span>
          </p>
        </div>
      )}

      {result.status === "NOT_ANCHORED" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
          <p className="text-yellow-800 font-medium">Not yet anchored on Stellar.</p>
          <p className="text-sm text-yellow-700">
            This audit record has not been submitted to the Stellar blockchain yet.
          </p>
          {result.storedHash && (
            <div className="text-sm">
              <span className="text-gray-600">Record hash: </span>
              <span className="font-mono text-xs break-all text-gray-800">
                {result.storedHash}
              </span>
            </div>
          )}
        </div>
      )}

      {result.status === "VERIFIED" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <p className="text-green-800 font-semibold text-lg">✓ Verified</p>
          <p className="text-sm text-green-700">
            All three hashes match: the stored hash, the recomputed hash, and the
            on-chain value are identical.
          </p>
          <HashRow label="Record hash" value={result.storedHash} />
        </div>
      )}

      {result.status === "FAILED" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-red-800 font-semibold text-lg">✗ Verification Failed</p>
          <p className="text-sm text-red-700">
            The hashes do not all match. The on-chain record may not correspond to
            the stored payload.
          </p>
          <HashRow label="Stored hash" value={result.storedHash} />
          <HashRow label="Recomputed hash" value={result.recomputedHash} />
          <HashRow label="On-chain hash" value={result.onChainHash} />
        </div>
      )}

      {/* Timestamps — shown for VERIFIED and NOT_ANCHORED */}
      {(result.status === "VERIFIED" || result.status === "NOT_ANCHORED") && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Timestamps
          </h2>
          {result.firstMessageAt && (
            <div className="text-sm">
              <span className="text-gray-600">First message received at: </span>
              <span className="text-gray-900">
                {result.firstMessageAt.toISOString()}
              </span>
            </div>
          )}
          {result.ledgerCloseTime && (
            <div className="text-sm">
              <span className="text-gray-600">Stellar ledger closed at: </span>
              <span className="text-gray-900">
                {result.ledgerCloseTime.toISOString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stellar transaction link — shown when anchored */}
      {result.stellarTxHash && (
        <div className="text-sm space-y-1">
          <span className="text-gray-600">Stellar TX: </span>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${result.stellarTxHash}`}
            className="font-mono text-xs text-blue-600 hover:underline break-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            {result.stellarTxHash}
          </a>
        </div>
      )}

      {/* Audit ID */}
      <div className="text-xs text-gray-500">
        Audit ID: <span className="font-mono">{auditId}</span>
      </div>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-sm">
      <span className="text-gray-600">{label}: </span>
      <span className="font-mono text-xs break-all text-gray-800">
        {value ?? "—"}
      </span>
    </div>
  );
}
