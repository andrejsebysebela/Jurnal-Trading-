import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h2 className="text-2xl font-semibold">Welcome back</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">Sign in to your trading journal.</p>
      {error === "link" && <p role="alert" className="mb-4 rounded-lg border border-gold/30 bg-gold/[0.08] px-3 py-2 text-sm text-fg-2">That link is invalid or has expired. Sign in, or request a new password reset link.</p>}
      <AuthForm mode="login" next={next} />
    </>
  );
}
