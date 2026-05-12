const EMAIL_HINT = /@/

export const INVITE_FILE_MAX_BYTES = 2 * 1024 * 1024

function normalizeInviteEmail(raw: string): string | null {
  const value = raw.trim().replace(/^["'<>]+|["'<>]+$/g, '').toLowerCase()
  if (!value || !EMAIL_HINT.test(value)) return null
  return value
}

function dedupeEmails(emails: string[]): string[] {
  return Array.from(new Set(emails))
}

export function parseInviteEmailsFromText(text: string): string[] {
  const emails = text
    .split(/[\n,;]/)
    .map((part) => normalizeInviteEmail(part))
    .filter((value): value is string => value !== null)
  return dedupeEmails(emails)
}

function firstColumnFromDelimitedLine(line: string): string {
  const trimmed = line.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('\t')) return trimmed.split('\t')[0]?.trim() ?? ''
  if (trimmed.includes(';') && !trimmed.includes(',')) return trimmed.split(';')[0]?.trim() ?? ''
  return trimmed.split(',')[0]?.trim() ?? ''
}

function parseInviteEmailsFromDelimitedText(content: string): string[] {
  const emails: string[] = []
  for (const line of content.split(/\r?\n/)) {
    const candidate = normalizeInviteEmail(firstColumnFromDelimitedLine(line))
    if (candidate) emails.push(candidate)
  }
  return dedupeEmails(emails)
}

export async function parseInviteEmailsFromFile(file: File): Promise<string[]> {
  if (file.size > INVITE_FILE_MAX_BYTES) {
    throw new Error('O arquivo deve ter no máximo 2 MB')
  }

  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseInviteEmailsFromDelimitedText(await file.text())
  }

  throw new Error('Use um arquivo CSV ou TXT (.csv, .txt)')
}
