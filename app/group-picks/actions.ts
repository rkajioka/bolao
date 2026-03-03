"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isGlobalDeadlinePassed } from "@/lib/deadlines";

export async function saveGroupPicks(picks: { matchId: string; scoreA: number; scoreB: number }[]) {
  const session = await requireSession();

  const passed = await isGlobalDeadlinePassed();
  if (passed) {
    return { error: "O prazo para palpites dos grupos já passou." };
  }

  const matchIds = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: { id: true },
  });
  const validIds = new Set(matchIds.map((m) => m.id));

  for (const pick of picks) {
    if (!validIds.has(pick.matchId)) continue;
    const scoreA = Math.min(20, Math.max(0, pick.scoreA));
    const scoreB = Math.min(20, Math.max(0, pick.scoreB));
    await prisma.userMatchPick.upsert({
      where: {
        userId_matchId: { userId: session.userId, matchId: pick.matchId },
      },
      create: {
        userId: session.userId,
        matchId: pick.matchId,
        scoreA,
        scoreB,
      },
      update: { scoreA, scoreB },
    });
  }

  revalidatePath("/group-picks");
  return { ok: true };
}
