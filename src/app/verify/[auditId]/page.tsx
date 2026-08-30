/** Public, privacy-safe Stellar audit verification view. */
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Hash,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Alert, Badge, Card, StatusBadge } from "@/components/ui";
import { verifyAuditRecord } from "@/lib/stellar/verify";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function HashRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-2 break-all font-mono text-xs leading-5 text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const result = await verifyAuditRecord(auditId);
  const isSuccess = result.status === "VERIFIED";
  const isPending = result.status === "NOT_ANCHORED";

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/ops" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
          <ArrowLeft aria-hidden="true" size={16} /> Return to Operator Dashboard
        </Link>

        <div className="mt-7 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700"><FileCheck2 aria-hidden="true" size={15} /> Independent integrity check</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Audit Verification</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">This public view confirms the integrity status of a synthetic audit record without exposing reporter content, session material, or internal analysis.</p>
        </div>

        <Card className="mt-8 overflow-hidden">
          <div className={`border-b px-5 py-6 sm:px-7 ${isSuccess ? "border-emerald-200 bg-emerald-50" : isPending ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isSuccess ? "bg-emerald-100 text-emerald-700" : isPending ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
                  {isSuccess ? <CheckCircle2 aria-hidden="true" size={23} /> : isPending ? <Clock3 aria-hidden="true" size={23} /> : <XCircle aria-hidden="true" size={23} />}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Verification status</p>
                  <div className="mt-2"><StatusBadge status={result.status} /></div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700">
                    {isSuccess ? "Stored, recomputed, and on-chain hashes match." : isPending ? "The record exists but has not been anchored on Stellar yet." : result.status === "NOT_FOUND" ? "No public audit record was found for this identifier." : "The verification values do not all match; treat this record as unverified."}
                  </p>
                </div>
              </div>
              <Badge tone={isSuccess ? "success" : isPending ? "warning" : "danger"} icon={isSuccess ? CheckCircle2 : isPending ? Clock3 : ShieldAlert}>{isSuccess ? "Integrity confirmed" : isPending ? "Awaiting anchor" : "Review required"}</Badge>
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-7">
            {result.status === "NOT_FOUND" ? (
              <Alert tone="danger" role="alert"><p className="font-semibold">Audit record not found.</p><p className="mt-1">No audit record exists for this ID: <span className="font-mono text-xs">{auditId}</span>.</p></Alert>
            ) : null}
            {result.status === "NOT_ANCHORED" ? <Alert tone="warning"><p className="font-semibold">Not yet anchored on Stellar.</p><p className="mt-1">The record is stored locally and can be checked again after the anchor service completes.</p></Alert> : null}

            {result.status !== "NOT_FOUND" ? (
              <section aria-labelledby="hashes-title">
                <div className="flex items-center gap-2"><Hash aria-hidden="true" className="text-blue-700" size={18} /><h2 id="hashes-title" className="text-base font-bold text-slate-950">Record hashes</h2></div>
                <p className="mt-1 text-sm text-slate-600">Hashes are shown for independent comparison; no private payload is included.</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2"><HashRow label={result.status === "VERIFIED" ? "Record hash" : "Stored hash"} value={result.storedHash} />{result.status === "FAILED" ? <><HashRow label="Recomputed hash" value={result.recomputedHash} /><HashRow label="On-chain hash" value={result.onChainHash} /></> : null}</dl>
              </section>
            ) : null}

            {(result.status === "VERIFIED" || result.status === "NOT_ANCHORED") ? (
              <section aria-labelledby="timestamps-title" className="border-t border-slate-200 pt-6">
                <div className="flex items-center gap-2"><Clock3 aria-hidden="true" className="text-blue-700" size={18} /><h2 id="timestamps-title" className="text-base font-bold text-slate-950">Record timeline</h2></div>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">First message received</dt><dd className="mt-1 break-words text-sm text-slate-800">{formatDate(result.firstMessageAt) ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Stellar ledger closed</dt><dd className="mt-1 break-words text-sm text-slate-800">{formatDate(result.ledgerCloseTime) ?? "Not available"}</dd></div></dl>
              </section>
            ) : null}

            {result.stellarTxHash ? <section aria-labelledby="transaction-title" className="border-t border-slate-200 pt-6"><div className="flex items-center gap-2"><ShieldAlert aria-hidden="true" className="text-blue-700" size={18} /><h2 id="transaction-title" className="text-base font-bold text-slate-950">Stellar transaction</h2></div><a href={`https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(result.stellarTxHash)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 break-all rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-blue-700 hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><span className="break-all">{result.stellarTxHash}</span><ArrowUpRight aria-hidden="true" className="shrink-0" size={15} /></a></section> : null}
          </div>
        </Card>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Audit ID:</span><span className="break-all font-mono">{auditId}</span></div>
      </div>
    </div>
  );
}
