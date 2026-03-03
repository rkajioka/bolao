import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <>
      <h1 className="text-2xl font-bold">Bolão da Copa</h1>
      <p className="mt-2 text-foreground/80">Página inicial</p>
      <Card className="mt-4 p-4">Card padrão visível</Card>
    </>
  );
}
