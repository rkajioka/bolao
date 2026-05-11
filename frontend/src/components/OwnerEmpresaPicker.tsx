import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { empresaService } from '@/services/empresa.service'

interface OwnerEmpresaPickerProps {
  value: number | null
  onChange: (empresaId: number) => void
}

export function OwnerEmpresaPicker({ value, onChange }: OwnerEmpresaPickerProps) {
  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
  })

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <Building2 size={16} style={{ color: 'var(--accent)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Empresa ativa
        </p>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Como proprietário da plataforma, escolha a empresa para gerenciar equipe e configurações do bolão.
      </p>
      {isLoading ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Carregando empresas…</p>
      ) : (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-3 rounded-xl text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text)',
          }}
        >
          <option value="" disabled>
            Selecione uma empresa
          </option>
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.nome}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
