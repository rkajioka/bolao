"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import type { MatchStatus } from "@prisma/client";

const KNOCKOUT_STAGES = ["R16", "QF", "SF", "F", "THIRD"] as const;

export async function updateMatchResult(formData: FormData) {
  const session = await requireSession();

  const matchId = formData.get("matchId") as string;
  const scoreAStr = (formData.get("scoreA") as string)?.trim();
  const scoreBStr = (formData.get("scoreB") as string)?.trim();
  const status = formData.get("status") as MatchStatus | null;
  const winnerTeamIdForm = (formData.get("winnerTeamId") as string)?.trim() || null;

  if (!matchId) {
    redirect("/admin/matches?error=missing");
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      stage: true,
      teamAId: true,
      teamBId: true,
      scoreA: true,
      scoreB: true,
      status: true,
      winnerTeamId: true,
    },
  });
  if (!match) {
    redirect("/admin/matches?error=notfound");
  }

  const scoreA = scoreAStr === "" || scoreAStr === null ? null : parseInt(scoreAStr, 10);
  const scoreB = scoreBStr === "" || scoreBStr === null ? null : parseInt(scoreBStr, 10);
  if (scoreA !== null && (Number.isNaN(scoreA) || scoreA < 0)) {
    redirect("/admin/matches?error=score");
  }
  if (scoreB !== null && (Number.isNaN(scoreB) || scoreB < 0)) {
    redirect("/admin/matches?error=score");
  }
  const validStatuses: MatchStatus[] = ["PENDING", "LIVE", "FINISHED"];
  const newStatus = status && validStatuses.includes(status) ? status : match.status;
  const finalScoreA = scoreA ?? match.scoreA;
  const finalScoreB = scoreB ?? match.scoreB;

  const isKnockout = KNOCKOUT_STAGES.includes(match.stage as (typeof KNOCKOUT_STAGES)[number]);
  let newWinnerTeamId: string | null = null;

  if (isKnockout) {
    if (newStatus === "FINISHED" && finalScoreA !== null && finalScoreB !== null) {
      if (finalScoreA === finalScoreB) {
        if (
          winnerTeamIdForm !== match.teamAId &&
          winnerTeamIdForm !== match.teamBId
        ) {
          redirect("/admin/matches?error=winner");
        }
        newWinnerTeamId = winnerTeamIdForm;
      } else {
        newWinnerTeamId = finalScoreA > finalScoreB ? match.teamAId : match.teamBId;
      }
    }
  }

  const before = {
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    status: match.status,
    winnerTeamId: match.winnerTeamId,
  };
  const after = {
    scoreA: finalScoreA,
    scoreB: finalScoreB,
    status: newStatus,
    winnerTeamId: isKnockout ? newWinnerTeamId : match.winnerTeamId,
  };

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        scoreA: after.scoreA,
        scoreB: after.scoreB,
        status: after.status,
        ...(isKnockout ? { winnerTeamId: after.winnerTeamId } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "update_result",
        entityType: "Match",
        entityId: matchId,
        before,
        after,
      },
    }),
  ]);

  revalidatePath("/admin/matches");
  revalidatePath("/ranking");
  revalidatePath("/my-score");
  redirect("/admin/matches");
}
