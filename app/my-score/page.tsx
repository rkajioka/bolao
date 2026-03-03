import { requireSession } from "@/lib/auth";

export default async function MyScorePage() {
  await requireSession();
  return (
    <div>
      <h1 className="text-2xl font-bold">Minha Pontuação</h1>
      <p className="mt-2 text-foreground/80">Conteúdo protegido.</p>
    </div>
  );
}
