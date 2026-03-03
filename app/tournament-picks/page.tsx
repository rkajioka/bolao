import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGlobalDeadlinePassed } from "./actions";
import { TournamentPicksForm } from "./TournamentPicksForm";

export default async function TournamentPicksPage() {
  const session = await requireSession();

  const [teams, pick, deadlinePassed] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ groupLetter: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    prisma.userTournamentPick.findUnique({
      where: { userId: session.userId },
      include: { championTeam: true },
    }),
    isGlobalDeadlinePassed(),
  ]);

  const championLabel = pick?.championTeam
    ? `${pick.championTeam.name} (${pick.championTeam.code})`
    : "";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Palpites do Torneio</h1>
      <p className="text-sm text-foreground/80">
        Campeão, Bola de Ouro, Chuteira de Ouro e Luva de Ouro. O prazo encerra 1h antes do primeiro jogo dos grupos.
      </p>
      {deadlinePassed && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-amber-400">
          O prazo para alterar estes palpites já passou.
        </div>
      )}
      <TournamentPicksForm
        teams={teams}
        initialChampionId={pick?.championTeamId ?? null}
        initialChampionLabel={championLabel}
        initialGoldenBall={pick?.goldenBall ?? ""}
        initialGoldenBoot={pick?.goldenBoot ?? ""}
        initialGoldenGlove={pick?.goldenGlove ?? ""}
        disabled={deadlinePassed}
      />
    </div>
  );
}
