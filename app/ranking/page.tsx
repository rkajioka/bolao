import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getRanking } from "@/lib/scoring";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function RankingPage() {
  const session = await getSession();
  const ranking = await getRanking(session?.userId ?? null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Ranking</h1>
      <p className="text-sm text-foreground/80">
        Ordenado por total de pontos, depois exatos, depois desfechos.
      </p>

      {ranking.length === 0 ? (
        <Card className="p-4 text-foreground/70">
          Nenhum participante ainda.
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-2 font-medium">#</th>
                  <th className="p-2 font-medium">Participante</th>
                  <th className="p-2 font-medium text-right">Total</th>
                  <th className="p-2 font-medium text-right">Exatos</th>
                  <th className="p-2 font-medium text-right">Desfechos</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((entry, index) => {
                  const isCurrentUser = session?.userId === entry.userId;
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-b border-white/5 ${
                        isCurrentUser
                          ? "bg-accent-green/10 font-medium"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <td className="p-2 font-mono text-foreground/70">
                        {index + 1}
                      </td>
                      <td className="p-2">
                        {entry.name || "Anônimo"}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-accent-green">
                            (você)
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {entry.total}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {entry.exactCount}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {entry.outcomeCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {ranking.map((entry, index) => {
              const isCurrentUser = session?.userId === entry.userId;
              return (
                <Card
                  key={entry.userId}
                  className={`p-4 ${
                    isCurrentUser ? "ring-2 ring-accent-green" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-medium text-foreground/70">
                        #{index + 1}
                      </span>
                      <span className="font-medium">
                        {entry.name || "Anônimo"}
                        {isCurrentUser && (
                          <span className="ml-1 text-accent-green">(você)</span>
                        )}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-accent-green">
                      {entry.total}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-sm text-foreground/70">
                    <span>Exatos: {entry.exactCount}</span>
                    <span>Desfechos: {entry.outcomeCount}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Link href="/">
        <Button variant="secondary">Voltar</Button>
      </Link>
    </div>
  );
}
