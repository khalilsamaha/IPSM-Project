import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">IPSM Music School</p>
          <h1 className="text-3xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Admin and reception staff access only.</p>
        </div>
        <LoginForm />
        <Link className="mt-4 block text-center text-sm text-primary hover:underline" href="/forgot-password">
          Forgot your password?
        </Link>
      </section>
    </main>
  );
}
