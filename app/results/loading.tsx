import { Skeleton, SkeletonCard, SkeletonHeading, SkeletonScreen } from "@/app/components/Skeleton"

export default function ResultsLoading() {
  return (
    <SkeletonScreen>
      <SkeletonHeading />
      <div className="space-y-8">
        {[0, 1].map((round) => (
          <div key={round}>
            <Skeleton className="mb-3 h-4 w-48" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  )
}
