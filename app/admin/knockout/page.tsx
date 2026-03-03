import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { createKnockoutMatch } from "./actions";

const STAGES = [
  { value: "R16", label: "Oitavas" },
  { value: "QF", label: "Quartas" },
  { value: "SF", label: "Semifinal" },
  { value: "F", label: "Final" },
  { value: "THIRD", label: "Terceiro lugar" },
];

const ERROR_MESSAGES: Record<string, string> = {
  stage: "Fase inválida.",
  teams: "Selecione dois times diferentes.",
  same: "Os dois times devem ser diferentes.",
  kickoff: "Data/hora em Brasília inválida (use YYYY-MM-DD HH:mm).",
};

export default async function AdminKnockoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params.error;

  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ groupLetter: "asc" }, { code: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    prisma.match.findMany({
      where: { stage: { in: ["R16", "QF", "SF", "F", "THIRD"] } },
      orderBy: [{ stage: "asc" }, { kickoffAt: "asc" }],
      include: {
        teamA: { select: { code: true, name: true } },
        teamB: { select: { code: true, name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Mata-mata</h1>
        <Link href="/admin">
          <Button variant="secondary">Voltar ao Admin</Button>
        </Link>
      </div>

      {errorKey && (
        <Card className="border-red-500/50 bg-red-500/10 p-3 text-red-400">
          {ERROR_MESSAGES[errorKey] ?? "Erro."}
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-medium">Novo jogo</h2>
        <form action={createKnockoutMatch} className="space-y-4">
          <div>
            <label htmlFor="stage" className="mb-1 block text-sm text-foreground/80">
              Fase
            </label>
            <select
              id="stage"
              name="stage"
              required
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="teamAId" className="mb-1 block text-sm text-foreground/80">
                Time A
              </label>
              <select
                id="teamAId"
                name="teamAId"
                required
                className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
              >
                <option value="">Selecione</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="teamBId" className="mb-1 block text-sm text-foreground/80">
                Time B
              </label>
              <select
                id="teamBId"
                name="teamBId"
                required
                className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
              >
                <option value="">Selecione</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="kickoff_brasilia" className="mb-1 block text-sm text-foreground/80">
              Data e hora (Brasília)
            </label>
            <input
              id="kickoff_brasilia"
              name="kickoff_brasilia"
              type="text"
              required
              placeholder="YYYY-MM-DD HH:mm"
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground placeholder:text-foreground/50 focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <Button type="submit">Criar jogo</Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <h2 className="border-b border-white/10 p-3 font-medium">
          Jogos mata-mata ({matches.length})
        </h2>
        {matches.length === 0 ? (
          <p className="p-4 text-foreground/70">Nenhum jogo cadastrado.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {matches.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  <Chip className="!py-0.5 !text-xs">
                    {STAGES.find((s) => s.value === m.stage)?.label ?? m.stage}
                  </Chip>
                  <span className="font-medium">{m.teamA.code}</span>
                  <span className="text-foreground/60">×</span>
                  <span className="font-medium">{m.teamB.code}</span>
                </span>
                <span className="text-sm text-foreground/70">
                  {new Date(m.kickoffAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
