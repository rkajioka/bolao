import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { LockConfirmButton } from "./LockConfirmButton";

export default async function GroupPicksReviewPage() {
  const session = await requireSession();

  const [matches, picks] = await Promise.all([
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
      select: { matchId: true, scoreA: true, scoreB: true, lockedAt: true },
    }),
  ]);

  const pickByMatch = new Map(picks.map((p) => [p.matchId, p]));
  const allLocked = picks.length > 0 && picks.every((p) => p.lockedAt != null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Revisão dos Palpites</h1>
      <p className="text-sm text-foreground/80">
        Confira seus palpites da fase de grupos. Após confirmar, não será mais possível alterar.
      </p>

      {allLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-amber-400">
          <span aria-hidden>🔒</span>
          <span>Palpites trancados. Não é possível editar.</span>
        </div>
      )}

      <div className="space-y-3">
        {matches.length === 0 ? (
          <Card className="p-4 text-foreground/70">
            Nenhum jogo dos grupos cadastrado.
          </Card>
        ) : (
          matches.map((match) => {
            const pick = pickByMatch.get(match.id);
            return (
              <Card key={match.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 mb-3">
                  <Chip>Grupo {match.groupLetter ?? "?"}</Chip>
                  <Chip>Rodada {match.round ?? "?"}</Chip>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {match.teamA.name} ({match.teamA.code})
                  </span>
                  <span className="font-mono text-foreground">
                    {pick ? `${pick.scoreA} × ${pick.scoreB}` : "— × —"}
                  </span>
                  <span className="text-sm font-medium text-right">
                    {match.teamB.name} ({match.teamB.code})
                  </span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {!allLocked && picks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <LockConfirmButton />
          <Link href="/group-picks">
            <Button variant="secondary">Voltar para editar</Button>
          </Link>
        </div>
      )}

      {!allLocked && picks.length === 0 && matches.length > 0 && (
        <p className="text-foreground/70">
          Faça seus palpites em{" "}
          <Link href="/group-picks" className="text-accent-green hover:underline">
            Palpites dos Grupos
          </Link>{" "}
          antes de confirmar.
        </p>
      )}

      <Link href="/">
        <Button variant="secondary">Início</Button>
      </Link>
    </div>
  );
}
