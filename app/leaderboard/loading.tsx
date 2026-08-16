import { Skeleton, SkeletonHeading, SkeletonScreen } from "@/app/components/Skeleton"

export default function LeaderboardLoading() {
  return (
    <SkeletonScreen>
      <SkeletonHeading />
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {/* The board header is a solid navy panel, so it needs no skeleton. */}
        <div className="h-11 bg-board" />
        <div className="divide-y divide-line-soft">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-40" />
              <Skeleton className="h-4 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  )
}
