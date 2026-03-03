import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      <nav className="flex flex-wrap gap-2">
        <Link href="/admin/teams">
          <Button variant="secondary">Times</Button>
        </Link>
        <Link href="/admin/import">
          <Button variant="secondary">Importar CSV</Button>
        </Link>
        <Link href="/admin/matches">
          <Button variant="secondary">Resultados</Button>
        </Link>
      </nav>
    </div>
  );
}
