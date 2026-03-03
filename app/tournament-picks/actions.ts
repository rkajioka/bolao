"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isGlobalDeadlinePassed } from "@/lib/deadlines";

export { isGlobalDeadlinePassed };

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
