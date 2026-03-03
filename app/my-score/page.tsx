import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  calculateMatchPoints,
  calculateUserTotal,
  type ScoringConfig,
} from "@/lib/scoring";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

const STAGES: Record<string, string> = {
  GROUP: "Grupos",
  R16: "Oitavas",
  QF: "Quartas",
  SF: "Semifinal",
  F: "Final",
  THIRD: "Terceiro",
};

function reasonLabel(reason: "EXACT" | "OUTCOME" | null): string {
  if (reason === "EXACT") return "Exato";
  if (reason === "OUTCOME") return "Acertou desfecho";
  return "—";
}

export default async function MyScorePage() {
  const session = await requireSession();

  const [picks, configRow] = await Promise.all([
    prisma.userMatchPick.findMany({
      where: { userId: session.userId },
      include: {
        match: {
          include: {
            teamA: { select: { code: true, name: true } },
            teamB: { select: { code: true, name: true } },
            winnerTeam: { select: { code: true } },
          },
        },
        winnerTeam: { select: { code: true } },
      },
      orderBy: [{ match: { kickoffAt: "asc" } }],
    }),
    prisma.scoringConfig.findFirst(),
  ]);

  const config: ScoringConfig = configRow
    ? { exact: configRow.exact, outcome: configRow.outcome }
    : { exact: 3, outcome: 1 };

  const { total, exactCount, outcomeCount } = await calculateUserTotal(
    session.userId
  );

  const rows = picks.map((p) => {
    const m = p.match;
    const result = calculateMatchPoints(
      {
        scoreA: p.scoreA,
        scoreB: p.scoreB,
        winnerTeamId: p.winnerTeamId,
      },
      {
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        status: m.status,
        stage: m.stage,
        winnerTeamId: m.winnerTeamId,
      },
      config
    );
    return {
      match: m,
      pick: p,
      points: result.points,
      reason: result.reason,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Minha Pontuação</h1>

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-foreground/70">Total</p>
            <p className="text-2xl font-bold text-accent-green">{total}</p>
          </div>
          <div>
            <p className="text-sm text-foreground/70">Exatos</p>
            <p className="text-2xl font-bold">{exactCount}</p>
          </div>
          <div>
            <p className="text-sm text-foreground/70">Desfechos</p>
            <p className="text-2xl font-bold">{outcomeCount}</p>
          </div>
        </div>
      </Card>

      <p className="text-sm text-foreground/80">
        Detalhe por jogo: seu palpite, resultado oficial e pontos.
      </p>

      {rows.length === 0 ? (
        <Card className="p-4 text-foreground/70">
          Você ainda não tem palpites. Faça palpites em Palpites dos Grupos ou
          Mata-mata.
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-2 font-medium">Jogo</th>
                  <th className="p-2 font-medium">Palpite</th>
                  <th className="p-2 font-medium">Resultado</th>
                  <th className="p-2 font-medium">Motivo</th>
                  <th className="p-2 font-medium text-right">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ match, pick, points, reason }) => (
                  <tr
                    key={pick.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="p-2">
                      <span className="font-medium">{match.teamA.code}</span>
                      <span className="mx-1 text-foreground/60">×</span>
                      <span className="font-medium">{match.teamB.code}</span>
                      <Chip className="ml-2 !py-0.5 !text-xs">
                        {STAGES[match.stage] ?? match.stage}
                      </Chip>
                    </td>
                    <td className="p-2 font-mono">
                      {pick.scoreA} × {pick.scoreB}
                      {pick.winnerTeam?.code && (
                        <span className="ml-1 text-foreground/70">
                          ({pick.winnerTeam.code})
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono">
                      {match.status === "FINISHED" &&
                      match.scoreA != null &&
                      match.scoreB != null
                        ? `${match.scoreA} × ${match.scoreB}`
                        : "—"}
                      {match.winnerTeam?.code && (
                        <span className="ml-1 text-foreground/70">
                          ({match.winnerTeam.code})
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-foreground/80">
                      {reasonLabel(reason)}
                    </td>
                    <td className="p-2 text-right font-medium">
                      {points > 0 ? (
                        <span className="text-accent-green">{points}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {rows.map(({ match, pick, points, reason }) => (
              <Card key={pick.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {match.teamA.code} × {match.teamB.code}
                  </span>
                  <Chip className="!py-0.5 !text-xs">
                    {STAGES[match.stage] ?? match.stage}
                  </Chip>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <dt className="text-foreground/70">Palpite</dt>
                  <dd className="font-mono">
                    {pick.scoreA} × {pick.scoreB}
                    {pick.winnerTeam?.code && ` (${pick.winnerTeam.code})`}
                  </dd>
                  <dt className="text-foreground/70">Resultado</dt>
                  <dd className="font-mono">
                    {match.status === "FINISHED" &&
                    match.scoreA != null &&
                    match.scoreB != null
                      ? `${match.scoreA} × ${match.scoreB}`
                      : "—"}
                    {match.winnerTeam?.code && ` (${match.winnerTeam.code})`}
                  </dd>
                  <dt className="text-foreground/70">Motivo</dt>
                  <dd>{reasonLabel(reason)}</dd>
                  <dt className="text-foreground/70">Pontos</dt>
                  <dd>
                    {points > 0 ? (
                      <span className="font-medium text-accent-green">
                        {points}
                      </span>
                    ) : (
                      "0"
                    )}
                  </dd>
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}

      <Link href="/">
        <Button variant="secondary">Voltar</Button>
      </Link>
    </div>
  );
}
