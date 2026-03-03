export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-primary px-4 py-3 sm:px-6">
      <h1 className="text-lg font-semibold sm:text-xl">Bolão da Copa</h1>
      <span className="truncate text-sm text-foreground/70">
        Deadline: —
      </span>
    </header>
  );
}
