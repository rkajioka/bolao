import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGlobalDeadlinePassed } from "@/lib/deadlines";
import { GroupPicksList } from "./GroupPicksList";

export default async function GroupPicksPage() {
  const session = await requireSession();

  const [matches, picks, deadlinePassed] = await Promise.all([
    prisma.match.findMany({
      where: { stage: "GROUP" },
      orderBy: [{ groupLetter: "asc" }, { round: "asc" }, { kickoffAt: "asc" }],
      include: {
        teamA: { select: { name: true, code: true } },
        teamB: { select: { name: true, code: true } },
      },
    }),
    prisma.userMatchPick.findMany({
      where: {
        userId: session.userId,
        match: { stage: "GROUP" },
      },
      select: { matchId: true, scoreA: true, scoreB: true },
    }),
    isGlobalDeadlinePassed(),
  ]);

  const initialPicks: Record<string, { scoreA: number; scoreB: number }> = {};
  for (const p of picks) {
    initialPicks[p.matchId] = { scoreA: p.scoreA, scoreB: p.scoreB };
  }
  for (const m of matches) {
    if (!initialPicks[m.id]) {
      initialPicks[m.id] = { scoreA: 0, scoreB: 0 };
    }
  }

  const total = matches.length;
  const filledCount = picks.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Palpites dos Grupos</h1>
      <p className="text-sm text-foreground/80">
        Palpite de placar em 90 minutos para cada jogo da fase de grupos.
      </p>
      {total === 0 ? (
        <p className="rounded-lg border border-white/10 bg-card p-4 text-foreground/70">
          Nenhum jogo dos grupos cadastrado. Importe o CSV em Admin → Importar CSV.
        </p>
      ) : (
        <GroupPicksList
          matches={matches.map((m) => ({
            id: m.id,
            groupLetter: m.groupLetter,
            round: m.round,
            teamA: m.teamA,
            teamB: m.teamB,
          }))}
          initialPicks={initialPicks}
          total={total}
          filledCount={filledCount}
          deadlinePassed={deadlinePassed}
        />
      )}
    </div>
  );
}
