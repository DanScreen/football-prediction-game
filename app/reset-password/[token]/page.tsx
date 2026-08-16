import Link from "next/link"
import { isResetTokenValid } from "@/lib/passwordReset"
import ResetPasswordForm from "./ResetPasswordForm"

export const metadata = { title: "Reset password" }

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const valid = await isResetTokenValid(token)

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink">Reset Password</h1>
          {valid && (
            <p className="mt-2 text-ink-muted text-sm">Choose a new password for your account.</p>
          )}
        </div>
        <div className="bg-surface rounded-xl shadow-card border border-line px-8 py-8">
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-ink-muted">
                This reset link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block text-pitch font-medium hover:underline text-sm"
              >
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
