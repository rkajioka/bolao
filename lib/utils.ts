export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Normaliza nome de jogador para name_norm (evitar duplicatas).
 * Trim, lowercase, colapsa espaços múltiplos.
 */
export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
