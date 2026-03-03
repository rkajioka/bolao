import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

export const dynamic = "force-dynamic";

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "object") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function AdminAuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const formatDate = (d: Date) =>
    d.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <Link href="/admin">
          <Button variant="secondary">Voltar ao Admin</Button>
        </Link>
      </div>

      {logs.length === 0 ? (
        <Card className="p-4 text-foreground/70">
          Nenhum registro de auditoria.
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-2 font-medium">Data</th>
                  <th className="p-2 font-medium">Usuário</th>
                  <th className="p-2 font-medium">Ação</th>
                  <th className="p-2 font-medium">Entidade</th>
                  <th className="p-2 font-medium">Before</th>
                  <th className="p-2 font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5">
                    <td className="p-2 text-foreground/80 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="p-2 text-foreground/80">
                      {log.user?.name ?? log.user?.email ?? "—"}
                    </td>
                    <td className="p-2">
                      <Chip className="!py-0.5 !text-xs">{log.action}</Chip>
                    </td>
                    <td className="p-2 text-foreground/80">
                      {log.entityType}
                      {log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ""}
                    </td>
                    <td className="p-2 max-w-[12rem]">
                      <pre className="overflow-auto rounded bg-primary/80 p-2 text-xs text-foreground/90 whitespace-pre-wrap break-all">
                        {formatJson(log.before)}
                      </pre>
                    </td>
                    <td className="p-2 max-w-[12rem]">
                      <pre className="overflow-auto rounded bg-primary/80 p-2 text-xs text-foreground/90 whitespace-pre-wrap break-all">
                        {formatJson(log.after)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {logs.map((log) => (
              <Card key={log.id} className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-foreground/70">
                    {formatDate(log.createdAt)}
                  </span>
                  <Chip className="!py-0.5 !text-xs">{log.action}</Chip>
                  <span className="text-sm text-foreground/80">
                    {log.user?.name ?? log.user?.email ?? "—"}
                  </span>
                </div>
                <p className="mb-2 text-sm text-foreground/80">
                  {log.entityType}
                  {log.entityId ? ` · ${log.entityId.slice(0, 12)}…` : ""}
                </p>
                {log.before != null && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-foreground/70 mb-1">Before</p>
                    <pre className="overflow-auto rounded border border-white/10 bg-primary/80 p-2 text-xs text-foreground/90 whitespace-pre-wrap break-all max-h-24">
                      {formatJson(log.before)}
                    </pre>
                  </div>
                )}
                {log.after != null && (
                  <div>
                    <p className="text-xs font-medium text-foreground/70 mb-1">After</p>
                    <pre className="overflow-auto rounded border border-white/10 bg-primary/80 p-2 text-xs text-foreground/90 whitespace-pre-wrap break-all max-h-24">
                      {formatJson(log.after)}
                    </pre>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
