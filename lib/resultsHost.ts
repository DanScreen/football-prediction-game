import { FixtureStatus } from "@/app/generated/prisma/client"

export function canEnterResult(status: FixtureStatus) {
  return status === FixtureStatus.AWAITING_RESULT || status === FixtureStatus.COMPLETED
}
