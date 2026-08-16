import { Skeleton, SkeletonCard, SkeletonHeading, SkeletonScreen } from "@/app/components/Skeleton"

export default function PredictionsLoading() {
  return (
    <SkeletonScreen>
      <SkeletonHeading />
      {[0, 1].map((round) => (
        <div key={round} className="mb-8">
          <Skeleton className="mb-3 h-5 w-36" />
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      ))}
    </SkeletonScreen>
  )
}
