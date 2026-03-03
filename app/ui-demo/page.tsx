import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { LockBadge } from "@/components/ui/LockBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreInputDemo } from "./ScoreInputDemo";

export default function UiDemoPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">UI Demo</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Card</h2>
        <Card className="p-4">Conteúdo do card</Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Button</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Chip</h2>
        <div className="flex flex-wrap gap-2">
          <Chip>Grupo A</Chip>
          <Chip>Rodada 1</Chip>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">LockBadge</h2>
        <LockBadge />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">ProgressBar</h2>
        <div className="space-y-2">
          <ProgressBar value={24} max={48} />
          <ProgressBar value={100} max={100} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">ScoreInput</h2>
        <ScoreInputDemo />
      </section>
    </div>
  );
}
