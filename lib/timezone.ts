/**
 * America/Sao_Paulo (Brasília) = UTC-3 (sem horário de verão).
 * Converte data/hora em Brasília para Date UTC (para armazenar no banco).
 */

const BRASILIA_UTC_OFFSET_HOURS = 3;

/**
 * Converte string "YYYY-MM-DD HH:mm" ou "DD/MM/YYYY HH:mm" (Brasília) para Date em UTC.
 */
export function brasiliaToUTC(dateTimeStr: string): Date {
  const trimmed = dateTimeStr.trim();
  let year: number;
  let month: number;
  let day: number;
  let hour: number;
  let minute: number;

  const spaceIdx = trimmed.indexOf(" ");
  const datePart = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
  const timePart = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1) : "00:00";
  const [hStr, mStr] = timePart.split(":").map((s) => s.trim());
  hour = parseInt(hStr ?? "0", 10) || 0;
  minute = parseInt(mStr ?? "0", 10) || 0;

  if (datePart.includes("-")) {
    const [y, m, d] = datePart.split("-").map((s) => parseInt(s, 10));
    year = y ?? 0;
    month = (m ?? 1) - 1;
    day = d ?? 1;
  } else if (datePart.includes("/")) {
    const parts = datePart.split("/").map((s) => parseInt(s, 10));
    if (parts.length >= 3) {
      day = parts[0] ?? 1;
      month = (parts[1] ?? 1) - 1;
      year = parts[2] ?? 0;
    } else {
      const [y, m, d] = datePart.split("/").map((s) => parseInt(s, 10));
      year = y ?? 0;
      month = (m ?? 1) - 1;
      day = d ?? 1;
    }
  } else {
    throw new Error(`Formato de data inválido: ${datePart}`);
  }

  const utcHours = hour + BRASILIA_UTC_OFFSET_HOURS;
  return new Date(Date.UTC(year, month, day, utcHours, minute, 0, 0));
}
