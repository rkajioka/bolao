"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { normalizePlayerName } from "@/lib/utils";

export async function addGoal(formData: FormData) {
  const session = await requireSession();

  const matchId = (formData.get("matchId") as string)?.trim();
  const teamId = (formData.get("teamId") as string)?.trim();
  const playerIdForm = (formData.get("playerId") as string)?.trim() || null;
  const playerNameForm = (formData.get("playerName") as string)?.trim() || null;
  const minuteStr = (formData.get("minute") as string)?.trim() || null;
  const minute = minuteStr ? parseInt(minuteStr, 10) : null;

  if (!matchId || !teamId) {
    redirect("/admin/goals?error=missing");
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, teamAId: true, teamBId: true },
  });
  if (!match) {
    redirect("/admin/goals?error=notfound");
  }
  if (teamId !== match.teamAId && teamId !== match.teamBId) {
    redirect("/admin/goals?error=invalid_team");
  }

  let playerId: string;

  if (playerIdForm) {
    const player = await prisma.player.findFirst({
      where: { id: playerIdForm, teamId },
      select: { id: true },
    });
    if (!player) {
      redirect("/admin/goals?error=invalid_player");
    }
    playerId = player.id;
  } else if (playerNameForm) {
    const nameNorm = normalizePlayerName(playerNameForm);
    if (!nameNorm) {
      redirect("/admin/goals?error=invalid_name");
    }
    const existing = await prisma.player.findFirst({
      where: { teamId, nameNorm },
      select: { id: true },
    });
    if (existing) {
      playerId = existing.id;
    } else {
      const created = await prisma.player.create({
        data: {
          teamId,
          name: playerNameForm.trim(),
          nameNorm,
        },
        select: { id: true },
      });
      playerId = created.id;
    }
  } else {
    redirect("/admin/goals?error=missing_player");
  }

  const goal = await prisma.matchGoal.create({
    data: {
      matchId,
      playerId,
      teamId,
      minute: minute ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "add_goal",
      entityType: "MatchGoal",
      entityId: goal.id,
      after: {
        matchId,
        playerId,
        teamId,
        minute: goal.minute,
      },
    },
  });

  revalidatePath("/admin/goals");
  redirect("/admin/goals");
}
