import LoginForm from "./LoginForm"

export const metadata = { title: "Sign In — Footy Predictor" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; registered?: string }>
}) {
  const { callbackUrl, registered } = await searchParams

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Welcome Back</h1>
          <p className="mt-2 text-zinc-500 text-sm">Sign in to make your predictions.</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-zinc-200 px-8 py-8">
          <LoginForm callbackUrl={callbackUrl} registered={registered === "1"} />
        </div>
      </div>
    </div>
  )
}
