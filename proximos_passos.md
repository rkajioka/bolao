# Próximos Passos — Bolão da Copa

> Documento de referência do estado atual do sistema e do roadmap de evolução.  
> Atualizado em: 2026-05-08 (revisão de itens implementados)

---

## O que foi feito

### Fundação (commits anteriores)

- **Autenticação completa**: login com JWT (access token 60min + refresh token 7 dias via cookie httponly), rotação de refresh tokens, logout, rate limiting
- **Primeiro acesso**: fluxo de onboarding (nome, função, senha); **upload de foto** via `POST /perfil/avatar` (sem URL manual)
- **Sistema de palpites**: palpites de jogos por fase/rodada, palpites especiais (campeão, vice, terceiro, artilheiro), bloqueio automático por horário
- **Pontuação**: engine de pontuação configurável por fase, recálculo automática quando admin finaliza jogo
- **Ranking**: leaderboard com pontos totais, insights por período; foto do usuário usa `coalesce(avatar_url, imagem_perfil)`
- **Admin**: interface tabbed para **jogos, usuários, especiais** (aba **Países removida** — cadastro de países tratado como fixo)
- **Grupos**: tabela de classificação dos grupos
- **Auditoria de admin**: log de ações administrativas em `auditoria_admin`
- **Dark/light mode**, design glass/premium, mobile-first

### Multi-empresa (2026-05-08)

#### Banco de dados
- Nova tabela `empresas` (id, nome, codigo_empresa, ativo)
- Nova tabela `convites` (token único, expiração 72h, uso único)
- Nova tabela `password_resets` (token único, expiração 60min, uso único)
- Nova tabela `audit_logs` (log completo: usuário, empresa, ação, IP, metadata)
- Tabela `usuarios` atualizada: `empresa_id`, `avatar_url`, `bloqueado`, `ultimo_login`
- Tabela **`configuracao_email`**: `resend_api_key`, `email_from` (singleton `id=1`) — credenciais Resend no BD
- Migration `a9b1c2d3e4f5_multi_empresa.py` com estratégia segura (usuários existentes vinculados à empresa DEFAULT)
- Migration **`f9e8d7c6b5a4`**: `configuracao_email` + seed inicial

#### Backend — novos / atualizados (trecho relevante)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/ativar-conta` | Ativa conta via token de convite, emite sessão |
| POST | `/auth/forgot-password` | Solicita reset (resposta genérica, anti-enumeração); **dispara e-mail** se Resend configurado no BD |
| POST | `/auth/redefinir-senha` | Redefine senha com token |
| GET | `/auth/reset-token-dev/{email}` | Expõe token de reset **somente** com `DEBUG=true` |
| GET | `/equipe/` | Lista membros e convites pendentes da empresa |
| POST | `/equipe/convites` | Bulk invite; **envia e-mail** quando `resend_api_key` + `email_from` estão preenchidos; resposta **sem `token`** nesse caso |
| GET | `/equipe/convites` | Lista convites (**ainda inclui `token`** na listagem — ver pendências) |
| PATCH | `/equipe/{id}/bloquear` | Bloquear/desbloquear usuário |
| DELETE | `/equipe/{id}` | Remover usuário da empresa |
| GET/PATCH | `/perfil/` | Perfil do usuário autenticado |
| POST | `/perfil/avatar` | Upload de foto (multipart), limite 2 MiB, JPEG/PNG/WebP |
| POST | `/perfil/alterar-senha` | Alterar senha |
| GET/POST/PATCH | `/empresas/*` | CRUD de empresas (admin global) |

#### Frontend — páginas
| Rota | Página | Descrição |
|------|--------|-----------|
| `/equipe` | `EquipePage` | Convites; mensagem quando convite foi **enviado por e-mail** (sem copiar link) |
| `/perfil` | `PerfilPage` | Nome, função, **upload de foto**, alterar senha |
| `/primeiro-acesso` | `PrimeiroAcessoPage` | **Upload de foto** + ícone genérico se não houver foto |
| `/ativar-conta?token=...` | `AtivarContaPage` | Onboarding via convite (avatar ainda pode ser URL aqui) |
| `/esqueci-senha` | `EsqueciSenhaPage` | Solicitar reset de senha |
| `/redefinir-senha?token=...` | `RedefinirSenhaPage` | Definir nova senha com token |

#### Envio de e-mail (Resend) — **OK**
- Dependência `resend>=2.0.0`, serviço [`app/services/email_service.py`](app/services/email_service.py)
- Credenciais lidas de **`configuracao_email`** (não de `RESEND_API_KEY` no `.env`)
- Links baseados em **`PUBLIC_APP_URL`** ([`app/core/config.py`](app/core/config.py))
- Convites e reset de senha integrados; fallback com `token` na resposta do POST quando e-mail não configurado ou falha do Resend

#### UX avatar — **OK**
- Componente [`UserAvatar`](frontend/src/components/UserAvatar.tsx) com ícone de pessoa quando não há foto (ranking, equipe, perfil, admin, layout)

#### Segurança aplicada
- Usuário bloqueado recebe 403 ao autenticar
- Tokens de convite e reset gerados com `secrets.token_urlsafe(48)`
- Resposta de forgot-password sempre genérica (anti-enumeração de e-mails)
- Rate limit em `/auth/forgot-password` (5 tentativas / 5 min por IP)
- Convites expiram em 72h, reset em 60min, ambos de uso único
- `audit_logs` registra: criação de convite, ativação de conta, reset de senha, bloqueio, remoção

---

## O que ainda precisa ser feito

### ~~Prioridade alta — item 1: Envio real de e-mails (Resend)~~ **OK**

Implementado conforme plano (chave e `email_from` no BD; `PUBLIC_APP_URL` no `.env`). Pendências menores opcionais:

- Ocultar ou mascarar `token` em **`GET /equipe/convites`** quando política de produção exigir só e-mail.
- Templates HTML mais ricos (ver item 9 abaixo).

---

### Prioridade alta — ainda em aberto

#### 2. Isolamento de ranking e palpites por empresa

**O que é:** o ranking ainda lista todos os usuários ativos do sistema. Em multi-empresa, filtrar por `empresa_id` do usuário autenticado (e alinhar insights).

**Status:** não implementado — próxima entrega prioritária sugerida.

---

#### 3. Vincular admin à empresa correta

**O que é:** `scripts/seed_admin.py` / fluxo inicial não garante empresa + admin por tenant.

**Status:** não implementado.

---

#### 4. Endpoint para admin convidar com `empresa_id` explícita

**O que é:** super-admin global vs admin de empresa.

**Status:** decisão de produto pendente; não implementado.

---

### Prioridade média

#### ~~5. Upload real de avatar~~ **OK** (MVP local)

Implementado: `POST /perfil/avatar`, arquivos em `static/uploads/avatars/`, primeiro acesso com upload, fallback com ícone. **Fora do escopo atual:** upload em Ativar conta por token (sem JWT) e Cloudinary/Supabase se quiser CDN.

---

#### 6. Reenviar convite

**Status:** não implementado — **bom próximo passo** após isolamento de ranking.

---

#### 7. Nome da empresa no perfil/header

**Status:** não implementado — **implementável agora** (endpoint ou `empresa_nome` no `UsuarioRead`).

---

#### 8. Página de convite com informações da empresa

**Status:** não implementado — **implementável agora** (`GET /auth/convite-info?token=...` + `AtivarContaPage`).

---

#### 9. Templates de e-mail com HTML bonito

**Status:** e-mails são HTML mínimo; melhoria cosmética quando quiser.

---

### Prioridade baixa

#### 14. Painel super-admin  
**Status:** não implementado.

#### 15. RBAC mais granular  
**Status:** não implementado.

---

## O que já dá para implementar (sem dependências bloqueantes)

Sugestão de ordem:

1. **Isolamento do ranking (e insights) por `empresa_id`** — maior impacto em produção multi-tenant; revisar rotas de ranking e queries em [`app/services/ranking_service.py`](app/services/ranking_service.py).
2. **Nome da empresa no perfil/header** — UX rápida; join ou rota `GET /empresas/minha`.
3. **`GET /auth/convite-info?token=...`** — melhora confiança na ativação; rota pública só com token válido.
4. **Reenviar convite** — endpoint + botão na `EquipePage`.
5. **Remover/mascarar `token` em `GET /equipe/convites`** — endurecimento de segurança.
6. **Seed / script empresa + admin** — item 3 do doc.
7. **Templates de e-mail** — quando identidade visual estiver definida.

---

## Estado atual dos fluxos

### Convite
- Com Resend configurado no BD: usuário recebe e-mail com link; resposta do POST pode vir **sem** `token`.
- Sem Resend ou falha de envio: resposta do POST inclui `token` para o admin copiar (modo dev/fallback).

### Reset de senha
- Com Resend: e-mail com link para `/redefinir-senha?token=...`.
- Sem e-mail: com `DEBUG=true`, `GET /auth/reset-token-dev/{email}` ainda disponível para testes.

---

## Configuração em produção (resumo)

```env
DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/bolao
JWT_SECRET=gere-com-openssl-rand-hex-32
JWT_REFRESH_COOKIE_SECURE=true
DEBUG=false
PUBLIC_APP_URL=https://seu-dominio.com
```

**Resend:** após `alembic upgrade head`, preencher no Postgres:

```sql
UPDATE configuracao_email
SET resend_api_key = 're_...', email_from = 'noreply@seudominio.com'
WHERE id = 1;
```

(`email_from` precisa ser domínio verificado no Resend, exceto testes com `onboarding@resend.dev`.)

---

## Arquivos de referência por tema

| Tema | Backend | Frontend |
|------|---------|----------|
| ~~Resend / e-mail~~ **OK** | `email_service.py`, `configuracao_email*`, `convite_service.py`, `password_reset_service.py`, `core/config.py` | `EquipePage.tsx`, tipos `ConviteResultado` |
| Isolamento ranking | `ranking_service.py`, `routes/ranking.py` | Nenhum |
| ~~Upload avatar~~ **OK** | `routes/perfil.py`, `avatar_upload_service.py` | `PerfilPage.tsx`, `PrimeiroAcessoPage.tsx`, `UserAvatar.tsx` |
| Reenviar convite | `routes/equipe.py`, `convite_service.py` | `EquipePage.tsx` |
| Nome empresa no perfil | `routes/empresas.py` ou `schemas/usuario.py` | `PerfilPage.tsx`, `AppLayout.tsx` |
| Info convite público | `routes/auth.py` | `AtivarContaPage.tsx` |
