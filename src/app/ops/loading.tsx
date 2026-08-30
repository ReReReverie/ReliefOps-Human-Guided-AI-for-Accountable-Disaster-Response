import { Skeleton } from "@/components/ui";

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-5 py-5"><Skeleton className="h-9 w-44" /></td>
      <td className="px-5 py-5"><Skeleton className="h-6 w-20 rounded-full" /></td>
      <td className="px-5 py-5"><Skeleton className="h-6 w-24 rounded-full" /></td>
      <td className="px-5 py-5"><Skeleton className="h-6 w-24 rounded-full" /></td>
      <td className="px-5 py-5"><Skeleton className="h-10 w-24" /></td>
      <td className="px-5 py-5"><Skeleton className="h-4 w-16" /></td>
    </tr>
  );
}
export default function OpsLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-transparent">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex items-end justify-between gap-4"><div className="space-y-3"><Skeleton className="h-3 w-40" /><Skeleton className="h-10 w-52" /><Skeleton className="h-4 w-80" /></div><Skeleton className="h-10 w-40" /></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex justify-between gap-4"><div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-64" /></div><Skeleton className="h-8 w-64" /></div></div>
        <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block"><table className="min-w-full"><thead><tr>{[1, 2, 3, 4, 5, 6].map((i) => <th key={i} className="px-5 py-4"><Skeleton className="h-3 w-20" /></th>)}</tr></thead><tbody>{[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</tbody></table></div>
        <div className="space-y-3 md:hidden">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      </div>
    </div>
  );
}
