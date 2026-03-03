import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createTeam, updateTeam, deleteTeam } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  required: "Nome e código são obrigatórios.",
  code_exists: "Código já existe.",
  create: "Erro ao criar time.",
  update: "Erro ao atualizar time.",
  delete: "Erro ao excluir (time pode estar em uso).",
};

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const params = await searchParams;
  const editId = params.edit;
  const errorKey = params.error;

  const [teams, editTeam] = await Promise.all([
    prisma.team.findMany({ orderBy: [{ groupLetter: "asc" }, { code: "asc" }] }),
    editId ? prisma.team.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Times</h1>
        <Link href="/admin">
          <Button variant="secondary">Voltar ao Admin</Button>
        </Link>
      </div>

      {errorKey && (
        <Card className="border-red-500/50 bg-red-500/10 p-3 text-red-400">
          {ERROR_MESSAGES[errorKey] ?? "Erro."}
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-medium">
          {editTeam ? "Editar time" : "Novo time"}
        </h2>
        <form
          action={editTeam ? updateTeam : createTeam}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {editTeam && <input type="hidden" name="id" value={editTeam.id} />}
          <div>
            <label htmlFor="name" className="mb-1 block text-sm text-foreground/80">
              Nome
            </label>
            <input
              id="name"
              name="name"
              defaultValue={editTeam?.name ?? ""}
              required
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <div>
            <label htmlFor="code" className="mb-1 block text-sm text-foreground/80">
              Código
            </label>
            <input
              id="code"
              name="code"
              defaultValue={editTeam?.code ?? ""}
              required
              maxLength={3}
              placeholder="BRA"
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <div>
            <label htmlFor="group_letter" className="mb-1 block text-sm text-foreground/80">
              Grupo (opcional)
            </label>
            <input
              id="group_letter"
              name="group_letter"
              defaultValue={editTeam?.groupLetter ?? ""}
              maxLength={1}
              placeholder="A"
              className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">{editTeam ? "Salvar" : "Criar"}</Button>
            {editTeam && (
              <Link href="/admin/teams">
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
            )}
          </div>
        </form>
      </Card>

      {/* Desktop: tabela */}
      <Card className="hidden overflow-hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-3 font-medium">Nome</th>
                <th className="p-3 font-medium">Código</th>
                <th className="p-3 font-medium">Grupo</th>
                <th className="p-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-foreground/60">
                    Nenhum time cadastrado.
                  </td>
                </tr>
              ) : (
                teams.map((team) => (
                  <tr
                    key={team.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="p-3">{team.name}</td>
                    <td className="p-3 font-mono">{team.code}</td>
                    <td className="p-3">{team.groupLetter ?? "—"}</td>
                    <td className="p-3 text-right">
                      <span className="flex flex-wrap justify-end gap-2">
                        <Link href={`/admin/teams?edit=${team.id}`}>
                          <Button type="button" variant="secondary" className="!py-1.5 !text-xs">
                            Editar
                          </Button>
                        </Link>
                        <form
                          action={deleteTeam}
                          className="inline"
                          onSubmit={(e) => {
                            if (!confirm("Excluir este time?")) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="id" value={team.id} />
                          <Button
                            type="submit"
                            variant="secondary"
                            className="!py-1.5 !text-xs text-red-400 hover:bg-red-500/20"
                          >
                            Excluir
                          </Button>
                        </form>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile: cards */}
      <div className="space-y-3 lg:hidden">
        {teams.length === 0 ? (
          <Card className="p-4 text-center text-foreground/60">
            Nenhum time cadastrado.
          </Card>
        ) : (
          teams.map((team) => (
            <Card key={team.id} className="p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-sm text-foreground/70">
                    {team.code}
                    {team.groupLetter ? ` · Grupo ${team.groupLetter}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/admin/teams?edit=${team.id}`}>
                    <Button type="button" variant="secondary" className="!py-1.5 !text-xs">
                      Editar
                    </Button>
                  </Link>
                  <form
                    action={deleteTeam}
                    className="inline"
                    onSubmit={(e) => {
                      if (!confirm("Excluir este time?")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={team.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      className="!py-1.5 !text-xs text-red-400"
                    >
                      Excluir
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
