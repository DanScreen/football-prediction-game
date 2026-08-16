import { Skeleton, SkeletonCard, SkeletonHeading, SkeletonScreen } from "@/app/components/Skeleton"

export default function DashboardLoading() {
  return (
    <SkeletonScreen>
      <SkeletonHeading />
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[74px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="mb-4 h-5 w-44" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </SkeletonScreen>
  )
}
