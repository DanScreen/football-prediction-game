import Link from "next/link"
import FixtureForm from "../FixtureForm"
import { createFixture } from "../actions"

export default function NewFixturePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin/fixtures" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Fixtures
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Add Fixture</h1>
      </div>
      <FixtureForm action={createFixture} submitLabel="Add Fixture" />
    </div>
  )
}
