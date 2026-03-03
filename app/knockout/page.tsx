import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMatchDeadlinePassed } from "@/lib/deadlines";
import { KnockoutPicksList } from "./KnockoutPicksList";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function KnockoutPage() {
  const session = await requireSession();

  const [matches, picks] = await Promise.all([
    prisma.match.findMany({
      where: { stage: { in: ["R16", "QF", "SF", "F", "THIRD"] } },
      orderBy: { kickoffAt: "asc" },
      include: {
        teamA: { select: { id: true, name: true, code: true } },
        teamB: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.userMatchPick.findMany({
      where: {
        userId: session.userId,
        match: { stage: { in: ["R16", "QF", "SF", "F", "THIRD"] } },
      },
      select: { matchId: true, scoreA: true, scoreB: true, winnerTeamId: true },
    }),
  ]);

  const initialPicks: Record<
    string,
    { scoreA: number; scoreB: number; winnerTeamId: string | null }
  > = {};
  for (const p of picks) {
    initialPicks[p.matchId] = {
      scoreA: p.scoreA,
      scoreB: p.scoreB,
      winnerTeamId: p.winnerTeamId,
    };
  }
  for (const m of matches) {
    if (!initialPicks[m.id]) {
      initialPicks[m.id] = { scoreA: 0, scoreB: 0, winnerTeamId: null };
    }
  }

  const matchList = matches.map((m) => ({
    id: m.id,
    stage: m.stage,
    teamA: m.teamA,
    teamB: m.teamB,
    deadlinePassed: isMatchDeadlinePassed(m.kickoffAt),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Palpites Mata-mata</h1>
      <p className="text-sm text-foreground/80">
        Placar em 90 minutos. Em caso de empate, escolha o classificado.
        Cada jogo trava 1h antes do início.
      </p>
      {matches.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-card p-4 text-foreground/70">
          Nenhum jogo do mata-mata cadastrado. Admin → Mata-mata.
        </p>
      ) : (
        <KnockoutPicksList matches={matchList} initialPicks={initialPicks} />
      )}
      <div className="pt-2">
        <Link href="/">
          <Button variant="secondary">Voltar ao início</Button>
        </Link>
      </div>
    </div>
  );
}
