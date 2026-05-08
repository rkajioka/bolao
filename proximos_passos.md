# Próximos Passos — Bolão da Copa

> Documento de referência do estado atual do sistema e do roadmap de evolução.
> Atualizado em: 2026-05-08

---

## O que foi feito

### Fundação (commits anteriores)

- **Autenticação completa**: login com JWT (access token 60min + refresh token 7 dias via cookie httponly), rotação de refresh tokens, logout, rate limiting
- **Primeiro acesso**: fluxo de onboarding para usuários criados pelo admin (define nome, função, senha)
- **Sistema de palpites**: palpites de jogos por fase/rodada, palpites especiais (campeão, vice, terceiro, artilheiro), bloqueio automático por horário
- **Pontuação**: engine de pontuação configurável por fase, recalculação automática quando admin finaliza jogo
- **Ranking**: leaderboard com pontos totais, insights por período (destaque de resultado, placar exato, marcadores Brasil)
- **Admin**: interface tabbed para gerenciar países, usuários, jogos, especiais
- **Grupos**: tabela de classificação dos grupos
- **Auditoria de admin**: log de ações administrativas em `auditoria_admin`
- **Dark/light mode**, design glass/premium, mobile-first

---

### Multi-empresa (implementado em 2026-05-08)

#### Banco de dados
- Nova tabela `empresas` (id, nome, codigo_empresa, ativo)
- Nova tabela `convites` (token único, expiração 72h, uso único)
- Nova tabela `password_resets` (token único, expiração 60min, uso único)
- Nova tabela `audit_logs` (log completo: usuário, empresa, ação, IP, metadata)
- Tabela `usuarios` atualizada: `empresa_id`, `avatar_url`, `bloqueado`, `ultimo_login`
- Migration `a9b1c2d3e4f5_multi_empresa.py` com estratégia segura (usuários existentes vinculados à empresa DEFAULT)

#### Backend — novos endpoints
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/ativar-conta` | Ativa conta via token de convite, emite sessão |
| POST | `/auth/forgot-password` | Solicita reset (resposta genérica, anti-enumeração) |
| POST | `/auth/redefinir-senha` | Redefine senha com token |
| GET | `/auth/reset-token-dev/{email}` | Expõe token de reset (só com `DEBUG=true`) |
| GET | `/equipe/` | Lista membros e convites pendentes da empresa |
| POST | `/equipe/convites` | Bulk invite (até 50 e-mails) |
| GET | `/equipe/convites` | Lista convites com status e token |
| PATCH | `/equipe/{id}/bloquear` | Bloquear/desbloquear usuário |
| DELETE | `/equipe/{id}` | Remover usuário da empresa |
| GET/PATCH | `/perfil/` | Perfil do usuário autenticado |
| POST | `/perfil/alterar-senha` | Alterar senha |
| GET/POST/PATCH | `/empresas/*` | CRUD de empresas (admin global) |

#### Frontend — novas páginas
| Rota | Página | Descrição |
|------|--------|-----------|
| `/equipe` | `EquipePage` | Gestão de equipe: lista membros, convites pendentes, bloquear, remover |
| `/perfil` | `PerfilPage` | Editar nome, função, avatar URL, alterar senha |
| `/ativar-conta?token=...` | `AtivarContaPage` | Onboarding via convite: define nome, senha, avatar |
| `/esqueci-senha` | `EsqueciSenhaPage` | Solicitar reset de senha |
| `/redefinir-senha?token=...` | `RedefinirSenhaPage` | Definir nova senha com token |

#### Segurança aplicada
- Usuário bloqueado recebe 403 ao autenticar
- Tokens de convite e reset gerados com `secrets.token_urlsafe(48)`
- Resposta de forgot-password sempre genérica (anti-enumeração de e-mails)
- Rate limit em `/auth/forgot-password` (5 tentativas / 5 min por IP)
- Convites expiram em 72h, reset em 60min, ambos de uso único
- `audit_logs` registra: criação de convite, ativação de conta, reset de senha, bloqueio, remoção

---

## O que ainda precisa ser feito

### Prioridade alta — necessário para funcionar em produção

#### 1. Envio real de e-mails (Resend)

**O que é:** substituir o fluxo manual de cópia de tokens por disparo automático de e-mail.

**Como implementar:**

1. Criar conta no [Resend](https://resend.com) e obter API key
2. Adicionar dependência:
   ```
   resend>=2.0.0
   ```
3. Adicionar ao `.env`:
   ```
   RESEND_API_KEY=re_xxxx
   EMAIL_FROM=bolao@suaempresa.com
   ```
4. Adicionar ao `config.py`:
   ```python
   resend_api_key: str = ""
   email_from: str = "bolao@suaempresa.com"
   ```
5. Criar `app/services/email_service.py`:
   ```python
   import resend

   def enviar_convite(email: str, token: str, empresa: str) -> None:
       link = f"https://seudominio.com/ativar-conta?token={token}"
       resend.Emails.send({
           "from": settings.email_from,
           "to": email,
           "subject": f"Você foi convidado para o Bolão — {empresa}",
           "html": f"<p>Clique <a href='{link}'>aqui</a> para ativar sua conta.</p>",
       })

   def enviar_reset_senha(email: str, token: str) -> None:
       link = f"https://seudominio.com/redefinir-senha?token={token}"
       resend.Emails.send({
           "from": settings.email_from,
           "to": email,
           "subject": "Redefinição de senha — Bolão da Copa",
           "html": f"<p>Clique <a href='{link}'>aqui</a> para redefinir sua senha.</p>",
       })
   ```
6. Chamar `email_service.enviar_convite()` dentro de `convite_service.criar_bulk_convites()`
7. Chamar `email_service.enviar_reset_senha()` dentro de `password_reset_service.solicitar_reset()`
8. Remover o endpoint `/auth/reset-token-dev/{email}` (ou proteger por `DEBUG=true`)
9. Remover exibição de tokens na resposta de `/equipe/convites` (substituir por "convite enviado")

---

#### 2. Isolamento de ranking e palpites por empresa

**O que é:** atualmente o ranking lista todos os usuários do sistema. Em multi-empresa, cada empresa deve ver apenas seus próprios participantes.

**Como implementar:**

Em `app/services/ranking_service.py`, adicionar filtro `empresa_id` nas queries:
```python
# Onde lista usuarios para o ranking:
.where(Usuario.empresa_id == empresa_id)
```

Passar `empresa_id` como parâmetro para `listar_ranking()` e `obter_insights_periodo()`.

Atualizar `app/routes/ranking.py`:
```python
from app.auth.dependencies import get_empresa_id

@router.get("")
def get_ranking(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
    empresa_id: int = Depends(get_empresa_id),
):
    linhas_svc = ranking_service.listar_ranking(db, empresa_id=empresa_id)
```

Fazer o mesmo para `/palpites-jogos` e `/palpites-especiais` (verificar que usuário só vê os próprios palpites — isso já funciona por `usuario_id`, mas o admin não deve ver palpites de outras empresas).

---

#### 3. Vincular admin à empresa correta

**O que é:** o script `scripts/seed_admin.py` cria o admin sem `empresa_id`, ou com a empresa DEFAULT. Em produção, cada empresa deve ter seu próprio admin.

**Como implementar:**

Criar script `scripts/seed_empresa.py`:
```python
# Cria empresa + admin vinculado
empresa = Empresa(nome="Minha Empresa", codigo_empresa="MINHAEMPRESA")
db.add(empresa)
db.flush()

admin = Usuario(
    empresa_id=empresa.id,
    nome="Admin",
    email="admin@minhaempresa.com",
    senha_hash=hash_password("senha_inicial"),
    tipo_usuario="admin",
    primeiro_login=False,
)
db.add(admin)
db.commit()
```

Ou adicionar endpoint `/empresas/{id}/criar-admin` para uso interno.

---

#### 4. Endpoint para admin convidar com empresa_id explícita

**O que é:** atualmente um admin só pode convidar para sua própria empresa. Mas o admin "global" (sem empresa ou com tipo especial) precisa conseguir criar empresas e convidar para qualquer uma.

**Decisão a tomar:** definir se haverá um super-admin global separado dos admins de empresa, ou se todo admin é sempre de empresa.

---

### Prioridade média — melhora a experiência

#### 5. Upload real de avatar

**O que é:** atualmente o avatar é apenas uma URL manual. O usuário precisa hospedar a imagem em outro lugar.

**Opções:**
- **Cloudinary** (gratuito até certo volume): upload via API, retorna URL
- **Supabase Storage**: se já usar Supabase para banco
- **Upload local**: salvar em `/static/avatars/` e servir via FastAPI

**Como implementar com Cloudinary:**
1. `pip install cloudinary`
2. Criar endpoint `POST /perfil/avatar` que recebe `multipart/form-data`
3. Fazer upload para Cloudinary, salvar URL no `usuario.avatar_url`
4. No frontend, `PerfilPage` passa a ter um `<input type="file">` em vez de campo de URL

---

#### 6. Reenviar convite

**O que é:** na `EquipePage`, o admin deve poder reenviar um convite expirado ou pendente.

**Como implementar:**

Backend — adicionar em `equipe.py`:
```python
@router.post("/convites/{convite_id}/reenviar")
def reenviar_convite(convite_id: int, ...):
    # Invalida convite antigo, cria novo, envia e-mail
```

Frontend — adicionar botão "Reenviar" nos cards de convite pendente na `EquipePage`.

---

#### 7. Nome da empresa no perfil/header

**O que é:** o usuário vê "Empresa #1" na página de perfil. Deveria ver o nome real.

**Como implementar:**
- O endpoint `GET /auth/me` já retorna `empresa_id`
- Criar endpoint `GET /empresas/minha` que retorna os dados da empresa do usuário autenticado
- Ou incluir o campo `empresa_nome` no `UsuarioRead` via join no `usuario_service`

---

#### 8. Página de convite com informações da empresa

**O que é:** quando o usuário acessa `/ativar-conta?token=...`, ele não vê para qual empresa está sendo convidado.

**Como implementar:**
- Criar endpoint público `GET /auth/convite-info?token=...` que retorna `{ email, empresa_nome }` sem revelar outros dados
- Exibir o nome da empresa na `AtivarContaPage` antes de preencher o formulário

---

#### 9. Templates de e-mail com HTML bonito

**O que é:** os e-mails enviados pelo Resend são HTML simples. Criar templates com a identidade visual do produto.

**Sugestão:** usar [react-email](https://react.email) para criar templates em React/TSX e exportar para HTML estático, ou usar strings HTML inline com estilo inline.

---

### Prioridade baixa — evolução futura

#### 10. Múltiplos campeonatos

Atualmente o sistema é fixo para Copa do Mundo. Para suportar outros campeonatos (Libertadores, Copa do Brasil, etc.), seria necessário:
- Adicionar `campeonato_id` em `jogos`, `palpites_jogos`, `palpites_especiais`
- Cada empresa pode participar de múltiplos campeonatos

#### 11. Google OAuth / SSO

Permitir login social como alternativa à senha. Útil para empresas que já usam Google Workspace. Requer biblioteca `authlib` ou `python-social-auth`.

#### 12. MFA (autenticação de dois fatores)

TOTP via Google Authenticator ou SMS. Importante para contas de admin.

#### 13. Notificações push / WebSocket

Avisar usuários quando um jogo começa, quando o ranking muda, quando recebem palpite vencedor.

#### 14. Painel super-admin

Interface para gerenciar todas as empresas, ver relatórios globais, criar/desativar empresas.

#### 15. RBAC mais granular

Atualmente há apenas `admin` e `usuario`. Poderia ter:
- `viewer`: só vê, não pode palpitar
- `moderator`: pode editar jogos mas não criar usuários
- `company_owner`: pode criar admins na própria empresa

---

## Estado atual dos fluxos (o que funciona sem e-mail)

### Fluxo de convite (modo dev)
1. Admin acessa `/equipe` → clica "Convidar" → insere e-mails
2. Backend gera tokens e retorna na resposta (visível na UI)
3. Admin copia o link manualmente e envia para o usuário
4. Usuário acessa `/ativar-conta?token=...` → ativa a conta

### Fluxo de reset de senha (modo dev)
1. Usuário acessa `/esqueci-senha` → informa e-mail
2. Token gerado no banco (sem e-mail)
3. Admin busca o token em `GET /auth/reset-token-dev/{email}` (precisa `DEBUG=true` no `.env`)
4. Usuário acessa `/redefinir-senha?token=...` → redefine senha

---

## Configuração necessária em produção

```env
# .env
DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/bolao
JWT_SECRET=gere-com-openssl-rand-hex-32
JWT_REFRESH_COOKIE_SECURE=true
DEBUG=false

# Adicionar quando implementar Resend:
RESEND_API_KEY=re_xxxx
EMAIL_FROM=bolao@suaempresa.com
```

---

## Arquivos que precisam ser alterados para cada próximo passo

| Próximo passo | Arquivos backend | Arquivos frontend |
|---|---|---|
| Resend / e-mail | `services/email_service.py` (novo), `services/convite_service.py`, `services/password_reset_service.py`, `core/config.py` | Remover exibição de tokens na `EquipePage` |
| Isolamento ranking | `services/ranking_service.py`, `routes/ranking.py` | Nenhum |
| Upload avatar | `routes/perfil.py`, novo `routes/upload.py` | `PerfilPage.tsx`, `AtivarContaPage.tsx` |
| Reenviar convite | `routes/equipe.py`, `services/convite_service.py` | `EquipePage.tsx` |
| Nome empresa no perfil | `routes/empresas.py` ou `schemas/usuario.py` | `PerfilPage.tsx`, `AppLayout.tsx` |
| Info convite público | `routes/auth.py` | `AtivarContaPage.tsx` |
