import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImportForm } from "./ImportForm";

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Importar jogos (CSV)</h1>
        <Link href="/admin">
          <Button variant="secondary">Voltar ao Admin</Button>
        </Link>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm text-foreground/80">
          Cabeçalho obrigatório: <code className="rounded bg-white/10 px-1">team_a_code</code>,{" "}
          <code className="rounded bg-white/10 px-1">team_b_code</code>,{" "}
          <code className="rounded bg-white/10 px-1">kickoff_brasilia</code>. Opcionais:{" "}
          <code className="rounded bg-white/10 px-1">group</code>,{" "}
          <code className="rounded bg-white/10 px-1">round</code>.
        </p>
        <p className="mb-4 text-sm text-foreground/70">
          Data/hora em Brasília: <code className="rounded bg-white/10 px-1">YYYY-MM-DD HH:mm</code> ou{" "}
          <code className="rounded bg-white/10 px-1">DD/MM/YYYY HH:mm</code>. Códigos dos times devem existir em Times.
        </p>
        <ImportForm />
      </Card>
    </div>
  );
}
