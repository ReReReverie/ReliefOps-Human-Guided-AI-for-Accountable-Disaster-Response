import { Skeleton } from "@/components/ui";

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><Skeleton className="h-5 w-48" /><div className="mt-5 space-y-3">{Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className={index % 2 === 0 ? "h-10 w-full" : "h-6 w-4/5"} />)}</div></div>;
}

export default function CaseDetailLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-transparent">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Skeleton className="h-10 w-28" />
        <div className="mt-5 border-b border-slate-200 pb-7"><Skeleton className="h-3 w-36" /><Skeleton className="mt-4 h-10 w-80" /><div className="mt-4 flex gap-2"><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-7 w-32 rounded-full" /><Skeleton className="h-5 w-48" /></div></div>
        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]"><div className="space-y-6"><SectionSkeleton rows={5} /><SectionSkeleton rows={6} /></div><aside className="space-y-6"><SectionSkeleton rows={3} /><SectionSkeleton rows={5} /><SectionSkeleton rows={6} /></aside></div>
      </div>
    </div>
  );
}
