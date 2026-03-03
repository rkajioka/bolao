"use client";

import { useState } from "react";
import { ScoreInput } from "@/components/ui/ScoreInput";

export function ScoreInputDemo() {
  const [score, setScore] = useState(0);
  const [lockedScore, setLockedScore] = useState(2);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-foreground/70">Ativo</span>
        <ScoreInput value={score} onChange={setScore} aria-label="Placar ativo" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-foreground/70">Travado (disabled)</span>
        <ScoreInput
          value={lockedScore}
          onChange={setLockedScore}
          disabled
          aria-label="Placar travado"
        />
      </div>
    </div>
  );
}
