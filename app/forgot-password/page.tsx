import ForgotPasswordForm from "./ForgotPasswordForm"

export const metadata = { title: "Forgot Password — Football Prediction App" }

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Forgot Password</h1>
          <p className="mt-2 text-zinc-500 text-sm">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-zinc-200 px-8 py-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}
