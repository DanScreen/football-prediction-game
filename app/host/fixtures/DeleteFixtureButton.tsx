"use client"

import { deleteFixture } from "./actions"

export default function DeleteFixtureButton({ id, label }: { id: string; label: string }) {
  async function handleDelete() {
    if (!confirm(`Delete ${label}?`)) return
    await deleteFixture(id)
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-red-500 hover:underline font-medium"
    >
      Delete
    </button>
  )
}
