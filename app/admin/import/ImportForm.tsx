"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { importMatchesCSV } from "./actions";

type Result = { ok: true; created: number; skipped: number; errors?: string[] } | { error: string };

export function ImportForm() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await importMatchesCSV(formData);
    setResult(res as Result);
    setPending(false);
    if ("ok" in res && res.ok) {
      form.reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="file" className="mb-1 block text-sm text-foreground/80">
          Arquivo CSV
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv"
          required
          className="w-full max-w-md rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground file:mr-3 file:rounded file:border-0 file:bg-accent-green file:px-3 file:py-1 file:text-primary file:font-medium"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Importando…" : "Importar"}
      </Button>

      {result && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
          {"error" in result ? (
            <p className="text-red-400">{result.error}</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground/90">
              <li>Jogos criados: {result.created}</li>
              {result.skipped > 0 && <li>Duplicados ignorados: {result.skipped}</li>}
              {result.errors && result.errors.length > 0 && (
                <li className="mt-2">
                  <span className="text-foreground/70">Erros:</span>
                  <ul className="mt-1 list-inside list-disc text-red-400">
                    {result.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>… e mais {result.errors.length - 10} erros</li>
                    )}
                  </ul>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
