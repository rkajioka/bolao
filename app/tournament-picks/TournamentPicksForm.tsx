"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChampionSelect } from "./ChampionSelect";
import { saveTournamentPicks } from "./actions";

type Team = { id: string; name: string; code: string };

export function TournamentPicksForm({
  teams,
  initialChampionId,
  initialChampionLabel,
  initialGoldenBall,
  initialGoldenBoot,
  initialGoldenGlove,
  disabled,
}: {
  teams: Team[];
  initialChampionId: string | null;
  initialChampionLabel: string;
  initialGoldenBall: string;
  initialGoldenBoot: string;
  initialGoldenGlove: string;
  disabled: boolean;
}) {
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const res = await saveTournamentPicks(formData);
    setResult(res);
    setPending(false);
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="champion" className="mb-1 block text-sm font-medium text-foreground/80">
            Campeão
          </label>
          <ChampionSelect
            teams={teams}
            defaultValue={initialChampionId}
            defaultLabel={initialChampionLabel}
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="golden_ball" className="mb-1 block text-sm font-medium text-foreground/80">
            Bola de Ouro
          </label>
          <input
            id="golden_ball"
            name="golden_ball"
            type="text"
            defaultValue={initialGoldenBall}
            disabled={disabled}
            placeholder="Nome do jogador"
            className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground placeholder:text-foreground/50 focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="golden_boot" className="mb-1 block text-sm font-medium text-foreground/80">
            Chuteira de Ouro
          </label>
          <input
            id="golden_boot"
            name="golden_boot"
            type="text"
            defaultValue={initialGoldenBoot}
            disabled={disabled}
            placeholder="Nome do jogador"
            className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground placeholder:text-foreground/50 focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="golden_glove" className="mb-1 block text-sm font-medium text-foreground/80">
            Luva de Ouro
          </label>
          <input
            id="golden_glove"
            name="golden_glove"
            type="text"
            defaultValue={initialGoldenGlove}
            disabled={disabled}
            placeholder="Nome do jogador"
            className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground placeholder:text-foreground/50 focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green disabled:opacity-50"
          />
        </div>
        {!disabled && (
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
      </form>
      {result && (
        <div className="mt-4 rounded-lg border border-white/10 p-3 text-sm">
          {"error" in result && result.error && (
            <p className="text-red-400">{result.error}</p>
          )}
          {"ok" in result && result.ok && (
            <p className="text-accent-green">Palpites salvos.</p>
          )}
        </div>
      )}
    </Card>
  );
}
