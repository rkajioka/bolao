import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { addGoal } from "./actions";

const STAGES: Record<string, string> = {
  GROUP: "Grupos",
  R16: "Oitavas",
  QF: "Quartas",
  SF: "Semifinal",
  F: "Final",
  THIRD: "Terceiro",
};

export default async function AdminGoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params.error;

  const matches = await prisma.match.findMany({
    orderBy: [
      { stage: "asc" },
      { groupLetter: "asc" },
      { round: "asc" },
      { kickoffAt: "asc" },
    ],
    include: {
      teamA: {
        select: { id: true, name: true, code: true },
        include: { players: { orderBy: { name: "asc" } } },
      },
      teamB: {
        select: { id: true, name: true, code: true },
        include: { players: { orderBy: { name: "asc" } } },
      },
      matchGoals: {
        include: {
          player: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Gols e Jogadores</h1>
        <Link href="/admin">
          <Button variant="secondary">Voltar ao Admin</Button>
        </Link>
      </div>

      {errorKey && (
        <Card className="border-red-500/50 bg-red-500/10 p-3 text-red-400">
          {errorKey === "missing" && "Match e time são obrigatórios."}
          {errorKey === "notfound" && "Jogo não encontrado."}
          {errorKey === "invalid_team" && "Time inválido para este jogo."}
          {errorKey === "invalid_player" && "Jogador inválido."}
          {errorKey === "invalid_name" && "Nome do jogador inválido."}
          {errorKey === "missing_player" && "Selecione um jogador ou informe o nome."}
          {!["missing", "notfound", "invalid_team", "invalid_player", "invalid_name", "missing_player"].includes(errorKey) && "Erro ao salvar."}
        </Card>
      )}

      {matches.length === 0 ? (
        <Card className="p-4 text-foreground/70">
          Nenhum jogo cadastrado.
        </Card>
      ) : (
        <div className="space-y-6">
          {matches.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {m.teamA.code} × {m.teamB.code}
                </span>
                <Chip className="!py-0.5 !text-xs">
                  {STAGES[m.stage] ?? m.stage}
                </Chip>
              </div>

              {m.matchGoals.length > 0 && (
                <div className="mb-4 rounded border border-white/10 bg-primary/50 p-3 text-sm">
                  <p className="mb-2 font-medium text-foreground/80">Gols registrados</p>
                  <ul className="space-y-1">
                    {m.matchGoals.map((g) => (
                      <li key={g.id}>
                        {g.player.name}
                        {g.minute != null ? ` (${g.minute}' )` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground/80">Gol – {m.teamA.code}</p>
                  <form action={addGoal} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="matchId" value={m.id} />
                    <input type="hidden" name="teamId" value={m.teamA.id} />
                    <label className="flex flex-col gap-1 text-sm">
                      Jogador
                      <select
                        name="playerId"
                        className="min-w-[10rem] rounded border border-white/10 bg-primary px-2 py-1.5 text-foreground"
                      >
                        <option value="">—</option>
                        {m.teamA.players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Min
                      <input
                        type="number"
                        name="minute"
                        min={0}
                        max={120}
                        placeholder="—"
                        className="w-14 rounded border border-white/10 bg-primary px-2 py-1.5 text-center text-foreground"
                      />
                    </label>
                    <Button type="submit" className="!py-1.5 !text-xs">
                      Adicionar
                    </Button>
                  </form>
                  <form action={addGoal} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="matchId" value={m.id} />
                    <input type="hidden" name="teamId" value={m.teamA.id} />
                    <label className="flex flex-col gap-1 text-sm">
                      Novo jogador (nome)
                      <input
                        type="text"
                        name="playerName"
                        placeholder="Nome"
                        className="min-w-[8rem] rounded border border-white/10 bg-primary px-2 py-1.5 text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Min
                      <input
                        type="number"
                        name="minute"
                        min={0}
                        max={120}
                        placeholder="—"
                        className="w-14 rounded border border-white/10 bg-primary px-2 py-1.5 text-center text-foreground"
                      />
                    </label>
                    <Button type="submit" variant="secondary" className="!py-1.5 !text-xs">
                      Criar e adicionar gol
                    </Button>
                  </form>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground/80">Gol – {m.teamB.code}</p>
                  <form action={addGoal} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="matchId" value={m.id} />
                    <input type="hidden" name="teamId" value={m.teamB.id} />
                    <label className="flex flex-col gap-1 text-sm">
                      Jogador
                      <select
                        name="playerId"
                        className="min-w-[10rem] rounded border border-white/10 bg-primary px-2 py-1.5 text-foreground"
                      >
                        <option value="">—</option>
                        {m.teamB.players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Min
                      <input
                        type="number"
                        name="minute"
                        min={0}
                        max={120}
                        placeholder="—"
                        className="w-14 rounded border border-white/10 bg-primary px-2 py-1.5 text-center text-foreground"
                      />
                    </label>
                    <Button type="submit" className="!py-1.5 !text-xs">
                      Adicionar
                    </Button>
                  </form>
                  <form action={addGoal} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="matchId" value={m.id} />
                    <input type="hidden" name="teamId" value={m.teamB.id} />
                    <label className="flex flex-col gap-1 text-sm">
                      Novo jogador (nome)
                      <input
                        type="text"
                        name="playerName"
                        placeholder="Nome"
                        className="min-w-[8rem] rounded border border-white/10 bg-primary px-2 py-1.5 text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Min
                      <input
                        type="number"
                        name="minute"
                        min={0}
                        max={120}
                        placeholder="—"
                        className="w-14 rounded border border-white/10 bg-primary px-2 py-1.5 text-center text-foreground"
                      />
                    </label>
                    <Button type="submit" variant="secondary" className="!py-1.5 !text-xs">
                      Criar e adicionar gol
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
