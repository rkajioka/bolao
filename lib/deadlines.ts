import { prisma } from "@/lib/db";

const DEADLINE_OFFSET_MS = 60 * 60 * 1000; // 1h antes (Brasília)

/**
 * Retorna o deadline global (1h antes do primeiro jogo dos grupos) em UTC.
 * Se não houver jogos GROUP, retorna null.
 */
export async function getGlobalDeadline(): Promise<Date | null> {
  const first = await prisma.match.findFirst({
    where: { stage: "GROUP" },
    orderBy: { kickoffAt: "asc" },
    select: { kickoffAt: true },
  });
  if (!first) return null;
  return new Date(first.kickoffAt.getTime() - DEADLINE_OFFSET_MS);
}

/**
 * Verifica se o deadline global já passou (comparação com agora em UTC).
 * Bloqueia palpites do torneio e (futuramente) palpites de grupos quando true.
 */
export async function isGlobalDeadlinePassed(): Promise<boolean> {
  const deadline = await getGlobalDeadline();
  if (!deadline) return false;
  return new Date() >= deadline;
}

/**
 * Deadline por jogo (mata-mata): 1h antes do kickoff (Brasília = armazenado em UTC).
 * Retorna true se já passou da hora de palpitarmos (trava 1h antes do jogo).
 */
export function isMatchDeadlinePassed(kickoffAt: Date): boolean {
  const deadline = new Date(kickoffAt.getTime() - DEADLINE_OFFSET_MS);
  return new Date() >= deadline;
}
