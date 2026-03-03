"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const DEADLINE_OFFSET_MS = 60 * 60 * 1000; // 1h antes

/**
 * Verifica se o deadline global (1h antes do primeiro jogo dos grupos) já passou.
 * Inline para COMMIT 12; lib/deadlines.ts em COMMIT 13.
 */
export async function isGlobalDeadlinePassed(): Promise<boolean> {
  const first = await prisma.match.findFirst({
    where: { stage: "GROUP" },
    orderBy: { kickoffAt: "asc" },
    select: { kickoffAt: true },
  });
  if (!first) return false;
  const deadline = new Date(first.kickoffAt.getTime() - DEADLINE_OFFSET_MS);
  return new Date() >= deadline;
}

export async function saveTournamentPicks(formData: FormData) {
  const session = await requireSession();

  const passed = await isGlobalDeadlinePassed();
  if (passed) {
    return { error: "O prazo para palpites do torneio já passou." };
  }

  const championTeamId = (formData.get("champion_team_id") as string)?.trim() || null;
  const goldenBall = (formData.get("golden_ball") as string)?.trim() || null;
  const goldenBoot = (formData.get("golden_boot") as string)?.trim() || null;
  const goldenGlove = (formData.get("golden_glove") as string)?.trim() || null;

  if (championTeamId) {
    const team = await prisma.team.findUnique({ where: { id: championTeamId } });
    if (!team) {
      return { error: "Time selecionado inválido." };
    }
  }

  await prisma.userTournamentPick.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      championTeamId,
      goldenBall,
      goldenBoot,
      goldenGlove,
    },
    update: {
      championTeamId,
      goldenBall,
      goldenBoot,
      goldenGlove,
    },
  });

  revalidatePath("/tournament-picks");
  return { ok: true };
}
