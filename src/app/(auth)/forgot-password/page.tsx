import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="text-2xl font-semibold">Reset your password</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">Enter your email and we&apos;ll send you a secure reset link.</p>
      <ForgotPasswordForm />
    </>
  );
}
