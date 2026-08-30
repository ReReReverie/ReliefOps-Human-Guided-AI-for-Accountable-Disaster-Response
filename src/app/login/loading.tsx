import { Skeleton } from "@/components/ui";

export default function LoginLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50 px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.92fr_1.08fr]">
        <Skeleton className="min-h-64 rounded-none bg-slate-900/90 lg:min-h-[30rem]" />
        <div className="space-y-6 px-6 py-8 sm:px-10 sm:py-12">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="space-y-5 pt-4">
            <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-12 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-12 w-full" /></div>
            <Skeleton className="h-12 w-full bg-blue-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
