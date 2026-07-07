import Link from "next/link"
import { isResetTokenValid } from "@/lib/passwordReset"
import ResetPasswordForm from "./ResetPasswordForm"

export const metadata = { title: "Reset Password — Football Prediction App" }

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
          <h1 className="text-3xl font-bold text-zinc-900">Reset Password</h1>
          {valid && (
            <p className="mt-2 text-zinc-500 text-sm">Choose a new password for your account.</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-md border border-zinc-200 px-8 py-8">
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-600">
                This reset link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block text-[#1a7a3c] font-medium hover:underline text-sm"
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
