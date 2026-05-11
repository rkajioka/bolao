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

async function parseInviteEmailsFromSpreadsheet(file: File): Promise<string[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(
    workbook.Sheets[sheetName],
    { header: 1, defval: '' },
  )

  const emails: string[] = []
  for (const row of rows) {
    const raw = row?.[0]
    const candidate = normalizeInviteEmail(String(raw ?? ''))
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
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseInviteEmailsFromSpreadsheet(file)
  }

  throw new Error('Use um arquivo CSV ou Excel (.csv, .xlsx, .xls)')
}
