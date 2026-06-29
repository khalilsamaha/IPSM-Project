import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-bold">Reset password</h1>
          <p className="text-sm text-muted-foreground">We will email a Supabase password reset link.</p>
        </div>
        <ForgotPasswordForm />
        <Link className="mt-4 block text-center text-sm text-primary hover:underline" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
