"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brasiliaToUTC } from "@/lib/timezone";

const EXPECTED_HEADER = "group,round,team_a_code,team_b_code,kickoff_brasilia";

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const row: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === "," && !inQuotes) || (c === ";" && !inQuotes)) {
        row.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    row.push(current.trim());
    return row;
  });
}

export async function importMatchesCSV(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Não autorizado." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Selecione um arquivo CSV." };
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return { error: "CSV deve ter cabeçalho e ao menos uma linha." };
  }

  const headerRow = rows[0].map((c) => c.toLowerCase().replace(/\s/g, "_"));
  const hasRequired = ["team_a_code", "team_b_code", "kickoff_brasilia"].every((col) =>
    headerRow.includes(col)
  );
  if (!hasRequired) {
    return {
      error: `Cabeçalho inválido. Obrigatórias: team_a_code, team_b_code, kickoff_brasilia. Opcionais: group, round. Exemplo: ${EXPECTED_HEADER}`,
    };
  }

  const colIdx = (name: string) => {
    const i = headerRow.indexOf(name);
    if (i === -1) return headerRow.indexOf(name.replace(/_/g, ""));
    return i;
  };
  const idxGroup = colIdx("group");
  const idxRound = colIdx("round");
  const idxTeamA = colIdx("team_a_code");
  const idxTeamB = colIdx("team_b_code");
  const idxKickoff = colIdx("kickoff_brasilia");
  if (idxTeamA === -1 || idxTeamB === -1 || idxKickoff === -1) {
    return { error: "Colunas obrigatórias: team_a_code, team_b_code, kickoff_brasilia." };
  }

  const teamsByCode = await prisma.team.findMany().then((list) => {
    const map = new Map<string, string>();
    list.forEach((t) => map.set(t.code.toUpperCase(), t.id));
    return map;
  });

  const created: string[] = [];
  const errors: string[] = [];
  const skipDuplicates: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const teamACode = (row[idxTeamA] ?? "").trim().toUpperCase();
    const teamBCode = (row[idxTeamB] ?? "").trim().toUpperCase();
    const kickoffStr = (row[idxKickoff] ?? "").trim();
    const groupLetter = idxGroup >= 0 ? (row[idxGroup] ?? "").trim().toUpperCase() || null : null;
    const roundStr = idxRound >= 0 ? (row[idxRound] ?? "").trim() : "";
    const round = roundStr ? parseInt(roundStr, 10) : null;

    if (!teamACode || !teamBCode || !kickoffStr) {
      errors.push(`Linha ${i + 1}: dados incompletos`);
      continue;
    }

    const teamAId = teamsByCode.get(teamACode);
    const teamBId = teamsByCode.get(teamBCode);
    if (!teamAId) {
      errors.push(`Linha ${i + 1}: time não encontrado: ${teamACode}`);
      continue;
    }
    if (!teamBId) {
      errors.push(`Linha ${i + 1}: time não encontrado: ${teamBCode}`);
      continue;
    }

    let kickoffAt: Date;
    try {
      kickoffAt = brasiliaToUTC(kickoffStr);
    } catch (e) {
      errors.push(`Linha ${i + 1}: data/hora inválida: ${kickoffStr}`);
      continue;
    }

    const existing = await prisma.match.findFirst({
      where: {
        stage: "GROUP",
        teamAId,
        teamBId,
        kickoffAt,
      },
    });
    if (existing) {
      skipDuplicates.push(`Linha ${i + 1}: jogo já existe`);
      continue;
    }

    const match = await prisma.match.create({
      data: {
        stage: "GROUP",
        groupLetter,
        round: Number.isNaN(round) || round == null ? undefined : round,
        teamAId,
        teamBId,
        kickoffAt,
      },
    });
    created.push(match.id);
  }

  if (created.length > 0 && session.userId) {
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "import_matches",
        entityType: "Match",
        after: { count: created.length, matchIds: created },
      },
    });
  }

  revalidatePath("/admin/import");
  revalidatePath("/admin/matches");

  return {
    ok: true,
    created: created.length,
    skipped: skipDuplicates.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}
