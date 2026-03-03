import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSession, getUserByEmail, hashPassword, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Cadastro</h1>
      <Card className="p-4">
        <form action={signupAction} className="space-y-4">
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
            <label htmlFor="name" className="mb-1 block text-sm text-foreground/80">
              Nome (opcional)
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
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
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <Button type="submit" className="w-full">
            Cadastrar
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-foreground/70">
        Já tem conta?{" "}
        <Link href="/login" className="text-accent-green hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

async function signupAction(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const password = formData.get("password") as string;
  if (!email || !password) {
    redirect("/signup?error=missing");
  }
  if (password.length < 6) {
    redirect("/signup?error=short");
  }
  const existing = await getUserByEmail(email);
  if (existing) {
    redirect("/signup?error=exists");
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: "USER",
    },
  });
  await createSession(user.id, user.role);
  redirect("/");
}
