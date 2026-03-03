"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ScoreInput } from "@/components/ui/ScoreInput";
import { saveKnockoutPicks, type KnockoutPickInput } from "./actions";

const STAGE_LABELS: Record<string, string> = {
  R16: "Oitavas",
  QF: "Quartas",
  SF: "Semifinal",
  F: "Final",
  THIRD: "3º lugar",
};

type Match = {
  id: string;
  stage: string;
  teamA: { id: string; name: string; code: string };
  teamB: { id: string; name: string; code: string };
  deadlinePassed: boolean;
};

type PickState = {
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
};

export function KnockoutPicksList({
  matches,
  initialPicks,
}: {
  matches: Match[];
  initialPicks: Record<string, PickState>;
}) {
  const [scores, setScores] = useState<Record<string, PickState>>(initialPicks);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, setPending] = useState(false);

  const updateScore = useCallback(
    (matchId: string, side: "scoreA" | "scoreB", value: number) => {
      setScores((prev) => {
        const cur = prev[matchId] ?? { scoreA: 0, scoreB: 0, winnerTeamId: null };
        const scoreA = side === "scoreA" ? value : cur.scoreA;
        const scoreB = side === "scoreB" ? value : cur.scoreB;
        const next: PickState = {
          scoreA,
          scoreB,
          winnerTeamId: scoreA === scoreB ? cur.winnerTeamId : null,
        };
        return { ...prev, [matchId]: next };
      });
    },
    []
  );

  const setWinner = useCallback((matchId: string, winnerTeamId: string | null) => {
    setScores((prev) => {
      const current = prev[matchId] ?? { scoreA: 0, scoreB: 0, winnerTeamId: null };
      return {
        ...prev,
        [matchId]: { ...current, winnerTeamId },
      };
    });
  }, []);

  const editableMatches = matches.filter((m) => !m.deadlinePassed);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setPending(true);
    const picks: KnockoutPickInput[] = matches.map((m) => {
      const s = scores[m.id] ?? { scoreA: 0, scoreB: 0, winnerTeamId: null };
      return {
        matchId: m.id,
        scoreA: s.scoreA,
        scoreB: s.scoreB,
        winnerTeamId: s.scoreA === s.scoreB ? s.winnerTeamId : null,
      };
    });
    const res = await saveKnockoutPicks(picks);
    setResult(res);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          {matches.map((match) => {
            const pick = scores[match.id] ?? { scoreA: 0, scoreB: 0, winnerTeamId: null };
            const isTie = pick.scoreA === pick.scoreB && pick.scoreA > 0;
            const disabled = match.deadlinePassed;

            return (
              <Card key={match.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 mb-3">
                  <Chip>{STAGE_LABELS[match.stage] ?? match.stage}</Chip>
                  {match.deadlinePassed && (
                    <span className="text-xs text-amber-400">Prazo encerrado</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[6rem] text-sm font-medium sm:min-w-[8rem]">
                    {match.teamA.name} ({match.teamA.code})
                  </span>
                  <div className="flex items-center gap-2">
                    <ScoreInput
                      value={pick.scoreA}
                      onChange={(v) => updateScore(match.id, "scoreA", v)}
                      disabled={disabled}
                      aria-label={`Placar ${match.teamA.code}`}
                    />
                    <span className="text-foreground/60">×</span>
                    <ScoreInput
                      value={pick.scoreB}
                      onChange={(v) => updateScore(match.id, "scoreB", v)}
                      disabled={disabled}
                      aria-label={`Placar ${match.teamB.code}`}
                    />
                  </div>
                  <span className="min-w-[6rem] text-sm font-medium sm:min-w-[8rem] text-right">
                    {match.teamB.name} ({match.teamB.code})
                  </span>
                </div>
                {isTie && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <label className="block text-sm text-foreground/80 mb-2">
                      Em caso de empate, classificado:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWinner(match.id, match.teamA.id)}
                        disabled={disabled}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          pick.winnerTeamId === match.teamA.id
                            ? "border-accent-green bg-accent-green/20 text-accent-green"
                            : "border-white/20 hover:bg-white/10"
                        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        {match.teamA.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWinner(match.id, match.teamB.id)}
                        disabled={disabled}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          pick.winnerTeamId === match.teamB.id
                            ? "border-accent-green bg-accent-green/20 text-accent-green"
                            : "border-white/20 hover:bg-white/10"
                        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        {match.teamB.name}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {editableMatches.length > 0 && (
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
