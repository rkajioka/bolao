"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { brasiliaToUTC } from "@/lib/timezone";
import type { MatchStage } from "@prisma/client";

const KNOCKOUT_STAGES: MatchStage[] = ["R16", "QF", "SF", "F", "THIRD"];

export async function createKnockoutMatch(formData: FormData) {
  await requireSession();

  const stage = formData.get("stage") as MatchStage | null;
  const teamAId = (formData.get("teamAId") as string)?.trim();
  const teamBId = (formData.get("teamBId") as string)?.trim();
  const kickoffStr = (formData.get("kickoff_brasilia") as string)?.trim();

  if (!stage || !KNOCKOUT_STAGES.includes(stage)) {
    redirect("/admin/knockout?error=stage");
  }
  if (!teamAId || !teamBId) {
    redirect("/admin/knockout?error=teams");
  }
  if (teamAId === teamBId) {
    redirect("/admin/knockout?error=same");
  }
  if (!kickoffStr) {
    redirect("/admin/knockout?error=kickoff");
  }

  let kickoffAt: Date;
  try {
    kickoffAt = brasiliaToUTC(kickoffStr);
  } catch {
    redirect("/admin/knockout?error=kickoff");
  }

  const teamA = await prisma.team.findUnique({ where: { id: teamAId } });
  const teamB = await prisma.team.findUnique({ where: { id: teamBId } });
  if (!teamA || !teamB) {
    redirect("/admin/knockout?error=teams");
  }

  await prisma.match.create({
    data: {
      stage,
      teamAId,
      teamBId,
      kickoffAt,
    },
  });

  revalidatePath("/admin/knockout");
  redirect("/admin/knockout");
}
