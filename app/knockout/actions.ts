"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isMatchDeadlinePassed } from "@/lib/deadlines";

const KNOCKOUT_STAGES = ["R16", "QF", "SF", "F", "THIRD"] as const;

export type KnockoutPickInput = {
  matchId: string;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
};

export async function saveKnockoutPicks(picks: KnockoutPickInput[]) {
  const session = await requireSession();

  const matchIds = picks.map((p) => p.matchId);
  const matches = await prisma.match.findMany({
    where: {
      id: { in: matchIds },
      stage: { in: [...KNOCKOUT_STAGES] },
    },
    select: {
      id: true,
      kickoffAt: true,
      teamAId: true,
      teamBId: true,
    },
  });
  const matchMap = new Map(matches.map((m) => [m.id, m]));

  for (const pick of picks) {
    const match = matchMap.get(pick.matchId);
    if (!match) continue;

    if (isMatchDeadlinePassed(match.kickoffAt)) {
      return { error: `O prazo para o jogo já passou (trava 1h antes do início).` };
    }

    const scoreA = Math.min(20, Math.max(0, pick.scoreA));
    const scoreB = Math.min(20, Math.max(0, pick.scoreB));

    if (scoreA === scoreB) {
      const validWinner =
        pick.winnerTeamId === match.teamAId || pick.winnerTeamId === match.teamBId;
      if (!validWinner) {
        return {
          error:
            "Em caso de empate no placar, é obrigatório escolher o classificado (time A ou time B).",
        };
      }
    }

    await prisma.userMatchPick.upsert({
      where: {
        userId_matchId: { userId: session.userId, matchId: pick.matchId },
      },
      create: {
        userId: session.userId,
        matchId: pick.matchId,
        scoreA,
        scoreB,
        winnerTeamId: scoreA === scoreB ? pick.winnerTeamId : null,
      },
      update: {
        scoreA,
        scoreB,
        winnerTeamId: scoreA === scoreB ? pick.winnerTeamId : null,
      },
    });
  }

  revalidatePath("/knockout");
  return { ok: true };
}
