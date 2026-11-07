import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");
  return (
    <>
      <h2 className="text-2xl font-semibold">Choose a new password</h2>
      <p className="mb-8 mt-1 text-sm text-fg-2">Signed in as {user.email}.</p>
      <ResetPasswordForm />
    </>
  );
}
