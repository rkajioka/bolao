import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSession, logout } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  return (
    <>
      <h1 className="text-2xl font-bold">Bolão da Copa</h1>
      <p className="mt-2 text-foreground/80">Página inicial</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {session ? (
          <>
            <span className="text-foreground/80">Logado</span>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary">
                Sair
              </Button>
            </form>
            <Link href="/my-score">
              <Button variant="secondary">Minha Pontuação</Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button>Entrar</Button>
            </Link>
            <Link href="/signup">
              <Button variant="secondary">Cadastrar</Button>
            </Link>
          </>
        )}
      </div>
      <Card className="mt-4 p-4">Card padrão visível</Card>
    </>
  );
}

async function logoutAction() {
  "use server";
  await logout();
  redirect("/");
}
