"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ScoreInput } from "@/components/ui/ScoreInput";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { saveGroupPicks } from "./actions";

type Match = {
  id: string;
  groupLetter: string | null;
  round: number | null;
  teamA: { name: string; code: string };
  teamB: { name: string; code: string };
};

type PickState = { scoreA: number; scoreB: number };

export function GroupPicksList({
  matches,
  initialPicks,
  total,
  filledCount,
  deadlinePassed,
}: {
  matches: Match[];
  initialPicks: Record<string, PickState>;
  total: number;
  filledCount: number;
  deadlinePassed: boolean;
}) {
  const [scores, setScores] = useState<Record<string, PickState>>(initialPicks);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, setPending] = useState(false);

  const updateScore = useCallback((matchId: string, side: "scoreA" | "scoreB", value: number) => {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        scoreA: prev[matchId]?.scoreA ?? 0,
        scoreB: prev[matchId]?.scoreB ?? 0,
        [side]: value,
      },
    }));
  }, []);

  const currentFilled = Object.keys(scores).filter(
    (id) => (scores[id]?.scoreA ?? 0) !== 0 || (scores[id]?.scoreB ?? 0) !== 0
  ).length;
  const displayFilled = Math.max(filledCount, currentFilled);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setPending(true);
    const picks = matches.map((m) => ({
      matchId: m.id,
      scoreA: scores[m.id]?.scoreA ?? 0,
      scoreB: scores[m.id]?.scoreB ?? 0,
    }));
    const res = await saveGroupPicks(picks);
    setResult(res);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/80">
          Progresso: <strong>{displayFilled}/{total}</strong> jogos
        </p>
        <ProgressBar value={displayFilled} max={total} className="max-w-xs" />
      </div>

      {deadlinePassed && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-amber-400">
          O prazo para alterar palpites dos grupos já passou.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          {matches.map((match) => (
            <Card key={match.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 mb-3">
                <Chip>Grupo {match.groupLetter ?? "?"}</Chip>
                <Chip>Rodada {match.round ?? "?"}</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-[6rem] text-sm font-medium sm:min-w-[8rem]">
                  {match.teamA.name} ({match.teamA.code})
                </span>
                <div className="flex items-center gap-2">
                  <ScoreInput
                    value={scores[match.id]?.scoreA ?? 0}
                    onChange={(v) => updateScore(match.id, "scoreA", v)}
                    disabled={deadlinePassed}
                    aria-label={`Placar ${match.teamA.code}`}
                  />
                  <span className="text-foreground/60">×</span>
                  <ScoreInput
                    value={scores[match.id]?.scoreB ?? 0}
                    onChange={(v) => updateScore(match.id, "scoreB", v)}
                    disabled={deadlinePassed}
                    aria-label={`Placar ${match.teamB.code}`}
                  />
                </div>
                <span className="min-w-[6rem] text-sm font-medium sm:min-w-[8rem] text-right">
                  {match.teamB.name} ({match.teamB.code})
                </span>
              </div>
            </Card>
          ))}
        </div>

        {!deadlinePassed && matches.length > 0 && (
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar palpites"}
            </Button>
            <Link href="/">
              <Button type="button" variant="secondary">
                Voltar
              </Button>
            </Link>
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-white/10 p-3 text-sm">
            {"error" in result && result.error && (
              <p className="text-red-400">{result.error}</p>
            )}
            {"ok" in result && result.ok && (
              <p className="text-accent-green">Palpites salvos.</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
