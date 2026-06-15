import RegisterForm from "./RegisterForm"

export const metadata = { title: "Register — Football Prediction App" }

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Join the League</h1>
          <p className="mt-2 text-zinc-500 text-sm">
            You&apos;ll need an invite code from the Commissioner.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-zinc-200 px-8 py-8">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
