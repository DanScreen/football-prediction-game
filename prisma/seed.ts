import "dotenv/config"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "../app/generated/prisma/client"

const url = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "")
const adapter = new PrismaBetterSqlite3({ url })
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.leagueSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      leagueName: "Footy Predictor",
      inviteCode: "GOAAALLL",
      grandSlamEnabled: false,
      grandSlamPoints: 3,
    },
  })
  console.log("Seeded LeagueSettings")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
