export const SENHA_COMPLEXIDADE_MSG =
  'A senha deve ter ao menos 8 caracteres, 1 letra maiúscula e 1 caractere especial'

export function validarSenhaSegura(senha: string): string | null {
  if (senha.length < 8) return SENHA_COMPLEXIDADE_MSG
  if (!/[A-Z]/.test(senha)) return SENHA_COMPLEXIDADE_MSG
  if (!/[^A-Za-z0-9]/.test(senha)) return SENHA_COMPLEXIDADE_MSG
  return null
}
