import Link from "next/link"

export const metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="score-digits mb-4 text-5xl text-ink-faint">404</p>
      <h1 className="mb-2 text-2xl font-bold text-ink">Off the pitch</h1>
      <p className="mb-8 text-ink-muted">
        That page doesn&apos;t exist. It may have been moved, or the link was mistyped.
      </p>
      <Link
        href="/"
        className="inline-block rounded-xl bg-pitch px-6 py-3 font-semibold text-pitch-on shadow-card transition-colors hover:bg-pitch-deep"
      >
        Back to the dashboard
      </Link>
    </div>
  )
}
