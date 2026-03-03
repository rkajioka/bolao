"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { lockGroupPicks } from "../actions";

export function LockConfirmButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (!confirm("Confirmar e trancar seus palpites? Não será possível alterar depois.")) {
      return;
    }
    setResult(null);
    setPending(true);
    const res = await lockGroupPicks();
    setResult(res);
    setPending(false);
    if ("ok" in res && res.ok) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={handleClick} disabled={pending}>
        {pending ? "Confirmando…" : "Confirmar e trancar"}
      </Button>
      {result && (
        <span className="text-sm">
          {"error" in result && result.error && (
            <span className="text-red-400">{result.error}</span>
          )}
          {"ok" in result && result.ok && (
            <span className="text-accent-green">Trancado.</span>
          )}
        </span>
      )}
    </div>
  );
}
