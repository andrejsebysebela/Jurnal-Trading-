import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h2 className="text-2xl font-semibold">Create your account</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">Start journaling with accurate, decimal-exact analytics.</p>
      <AuthForm mode="signup" />
    </>
  );
}
