import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h2 className="text-2xl font-semibold">Welcome back</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">Sign in to your trading journal.</p>
      <AuthForm mode="login" next={next} />
    </>
  );
}
