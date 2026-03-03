import { prisma } from "@/lib/db";

export type UserPick = {
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
};

export type MatchResult = {
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  stage: string;
  winnerTeamId: string | null;
};

export type ScoringConfig = {
  exact: number;
  outcome: number;
};

export type MatchPointsResult = {
  points: number;
  reason: "EXACT" | "OUTCOME" | null;
};

function outcome(scoreA: number, scoreB: number): "A" | "B" | "draw" {
  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";
  return "draw";
}

/**
 * Calcula pontos de um palpite para um jogo conforme regras:
 * - EXACT: placar 90min exato
 * - OUTCOME (grupos): acertou vencedor ou empate
 * - OUTCOME (mata-mata): acertou classificado (winnerTeamId)
 */
export function calculateMatchPoints(
  userPick: UserPick,
  match: MatchResult,
  config: ScoringConfig
): MatchPointsResult {
  if (
    match.status !== "FINISHED" ||
    match.scoreA === null ||
    match.scoreB === null
  ) {
    return { points: 0, reason: null };
  }

  const ma = match.scoreA;
  const mb = match.scoreB;
  const pa = userPick.scoreA;
  const pb = userPick.scoreB;

  if (pa === ma && pb === mb) {
    return { points: config.exact, reason: "EXACT" };
  }

  const isGroup = match.stage === "GROUP";
  if (isGroup) {
    const matchOutcome = outcome(ma, mb);
    const pickOutcome = outcome(pa, pb);
    if (matchOutcome === pickOutcome) {
      return { points: config.outcome, reason: "OUTCOME" };
    }
  } else {
    if (
      match.winnerTeamId &&
      userPick.winnerTeamId &&
      match.winnerTeamId === userPick.winnerTeamId
    ) {
      return { points: config.outcome, reason: "OUTCOME" };
    }
  }

  return { points: 0, reason: null };
}

/**
 * Calcula o total de pontos de um usuário (todos os jogos finalizados).
 */
export async function calculateUserTotal(userId: string): Promise<{
  total: number;
  exactCount: number;
  outcomeCount: number;
}> {
  const config = await prisma.scoringConfig.findFirst();
  const pointsConfig: ScoringConfig = config
    ? { exact: config.exact, outcome: config.outcome }
    : { exact: 3, outcome: 1 };

  const picks = await prisma.userMatchPick.findMany({
    where: { userId },
    include: {
      match: {
        select: {
          scoreA: true,
          scoreB: true,
          status: true,
          stage: true,
          winnerTeamId: true,
        },
      },
    },
  });

  let total = 0;
  let exactCount = 0;
  let outcomeCount = 0;

  for (const p of picks) {
    const match = p.match;
    const result = calculateMatchPoints(
      {
        scoreA: p.scoreA,
        scoreB: p.scoreB,
        winnerTeamId: p.winnerTeamId,
      },
      {
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        status: match.status,
        stage: match.stage,
        winnerTeamId: match.winnerTeamId,
      },
      pointsConfig
    );
    total += result.points;
    if (result.reason === "EXACT") exactCount++;
    if (result.reason === "OUTCOME") outcomeCount++;
  }

  return { total, exactCount, outcomeCount };
}

export type RankingEntry = {
  userId: string;
  name: string | null;
  total: number;
  exactCount: number;
  outcomeCount: number;
};

/**
 * Retorna o ranking ordenado por: total (desc), exatos (desc), outcomes (desc).
 * Inclui currentUserId na lista mesmo sem palpites (0 pontos).
 */
export async function getRanking(
  currentUserId?: string | null
): Promise<RankingEntry[]> {
  const userIds = await prisma.userMatchPick
    .findMany({ select: { userId: true }, distinct: ["userId"] })
    .then((rows) => rows.map((r) => r.userId));
  const allIds = new Set(userIds);
  if (currentUserId) allIds.add(currentUserId);

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(allIds) } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const entries: RankingEntry[] = [];
  for (const userId of allIds) {
    const { total, exactCount, outcomeCount } =
      await calculateUserTotal(userId);
    entries.push({
      userId,
      name: userMap.get(userId) ?? null,
      total,
      exactCount,
      outcomeCount,
    });
  }

  entries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    return b.outcomeCount - a.outcomeCount;
  });

  return entries;
}
