import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { updateMatchResult } from "./actions";

const STAGES: Record<string, string> = {
  GROUP: "Grupos",
  R16: "Oitavas",
  QF: "Quartas",
  SF: "Semifinal",
  F: "Final",
  THIRD: "Terceiro",
};

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params.error;

  const KNOCKOUT_STAGES = ["R16", "QF", "SF", "F", "THIRD"];

  const matches = await prisma.match.findMany({
    orderBy: [
      { stage: "asc" },
      { groupLetter: "asc" },
      { round: "asc" },
      { kickoffAt: "asc" },
    ],
    include: {
      teamA: { select: { id: true, name: true, code: true } },
      teamB: { select: { id: true, name: true, code: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Resultados dos Jogos</h1>
        <Link href="/admin">
          <Button variant="secondary">Voltar ao Admin</Button>
        </Link>
      </div>

      {errorKey && (
        <Card className="border-red-500/50 bg-red-500/10 p-3 text-red-400">
          {errorKey === "score" && "Placar inválido."}
          {errorKey === "notfound" && "Jogo não encontrado."}
          {errorKey === "missing" && "Dados incompletos."}
          {errorKey === "winner" && "Mata-mata com empate: informe o classificado."}
          {!["score", "notfound", "missing", "winner"].includes(errorKey) && "Erro ao salvar."}
        </Card>
      )}

      {matches.length === 0 ? (
        <Card className="p-4 text-foreground/70">
          Nenhum jogo cadastrado. Importe o CSV em Importar CSV.
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-2 font-medium">Jogo</th>
                  <th className="p-2 font-medium">Placar A</th>
                  <th className="p-2 font-medium">Placar B</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Classificado</th>
                  <th className="p-2 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const isKnockout = KNOCKOUT_STAGES.includes(m.stage);
                  return (
                    <tr key={m.id} className="border-b border-white/5">
                      <td className="p-2">
                        <span className="font-medium">{m.teamA.code}</span>
                        <span className="mx-1 text-foreground/60">×</span>
                        <span className="font-medium">{m.teamB.code}</span>
                        <span className="ml-2">
                          <Chip className="!py-0.5 !text-xs">
                            {STAGES[m.stage] ?? m.stage}
                          </Chip>
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          name="scoreA"
                          form={`form-${m.id}`}
                          defaultValue={m.scoreA ?? ""}
                          min={0}
                          className="w-14 rounded border border-white/10 bg-primary px-2 py-1 text-center text-foreground"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          name="scoreB"
                          form={`form-${m.id}`}
                          defaultValue={m.scoreB ?? ""}
                          min={0}
                          className="w-14 rounded border border-white/10 bg-primary px-2 py-1 text-center text-foreground"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          name="status"
                          form={`form-${m.id}`}
                          defaultValue={m.status}
                          className="rounded border border-white/10 bg-primary px-2 py-1 text-foreground"
                        >
                          <option value="PENDING">Pendente</option>
                          <option value="LIVE">Ao vivo</option>
                          <option value="FINISHED">Finalizado</option>
                        </select>
                      </td>
                      <td className="p-2">
                        {isKnockout ? (
                          <select
                            name="winnerTeamId"
                            form={`form-${m.id}`}
                            defaultValue={m.winnerTeamId ?? ""}
                            className="min-w-[6rem] rounded border border-white/10 bg-primary px-2 py-1 text-foreground"
                          >
                            <option value="">—</option>
                            <option value={m.teamA.id}>{m.teamA.code}</option>
                            <option value={m.teamB.id}>{m.teamB.code}</option>
                          </select>
                        ) : (
                          <span className="text-foreground/50">—</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <form id={`form-${m.id}`} action={updateMatchResult}>
                          <input type="hidden" name="matchId" value={m.id} />
                          <Button type="submit" className="!py-1.5 !text-xs">
                            Salvar
                          </Button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {matches.map((m) => {
              const isKnockout = KNOCKOUT_STAGES.includes(m.stage);
              return (
                <Card key={m.id} className="p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {m.teamA.code} × {m.teamB.code}
                    </span>
                    <Chip className="!py-0.5 !text-xs">
                      {STAGES[m.stage] ?? m.stage}
                    </Chip>
                  </div>
                  <form action={updateMatchResult} className="space-y-3">
                    <input type="hidden" name="matchId" value={m.id} />
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-foreground/70">Placar A</span>
                        <input
                          type="number"
                          name="scoreA"
                          defaultValue={m.scoreA ?? ""}
                          min={0}
                          className="w-14 rounded border border-white/10 bg-primary px-2 py-1 text-center text-foreground"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-foreground/70">Placar B</span>
                        <input
                          type="number"
                          name="scoreB"
                          defaultValue={m.scoreB ?? ""}
                          min={0}
                          className="w-14 rounded border border-white/10 bg-primary px-2 py-1 text-center text-foreground"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-foreground/70">Status</span>
                        <select
                          name="status"
                          defaultValue={m.status}
                          className="rounded border border-white/10 bg-primary px-2 py-1 text-foreground"
                        >
                          <option value="PENDING">Pendente</option>
                          <option value="LIVE">Ao vivo</option>
                          <option value="FINISHED">Finalizado</option>
                        </select>
                      </label>
                      {isKnockout && (
                        <label className="flex items-center gap-2 text-sm">
                          <span className="text-foreground/70">Classificado</span>
                          <select
                            name="winnerTeamId"
                            defaultValue={m.winnerTeamId ?? ""}
                            className="rounded border border-white/10 bg-primary px-2 py-1 text-foreground"
                          >
                            <option value="">—</option>
                            <option value={m.teamA.id}>{m.teamA.code}</option>
                            <option value={m.teamB.id}>{m.teamB.code}</option>
                          </select>
                        </label>
                      )}
                    </div>
                    <Button type="submit" className="!py-1.5 !text-xs">
                      Salvar
                    </Button>
                  </form>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
