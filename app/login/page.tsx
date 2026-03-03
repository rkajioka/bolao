import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSession, getUserByEmail, verifyPassword, createSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Entrar</h1>
      <Card className="p-4">
        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-foreground/80">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-foreground/80">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-foreground/70">
        Não tem conta?{" "}
        <Link href="/signup" className="text-accent-green hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}

async function loginAction(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const password = formData.get("password") as string;
  if (!email || !password) {
    redirect("/login?error=missing");
  }
  const user = await getUserByEmail(email);
  if (!user) {
    redirect("/login?error=invalid");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    redirect("/login?error=invalid");
  }
  await createSession(user.id, user.role);
  redirect("/");
}
