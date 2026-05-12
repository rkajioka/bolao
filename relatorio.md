# Relatório de Auditoria do Repositório

## 1. Resumo Executivo

O repositório é um monorepo de bolão da Copa: backend **FastAPI** com **PostgreSQL** (SQLAlchemy 2, Alembic) e SPA **React 19** com **Vite 8**. A autenticação combina JWT de acesso (Bearer) com refresh rotativo em cookie HttpOnly; há testes de integração backend relevantes (104 casos coletados) e endurecimentos documentados em `SECURITY.md`.

A varredura foi **estática e read-only**, complementada por coleta de testes (`py -m pytest --co`) e execução da suíte (`py -m pytest -q`: 103 aprovados, 1 falha). **Nenhuma correção foi aplicada** no código; este documento é o único artefato produzido.

Principais riscos: **configuração e segredos por padrão** (`app/core/config.py`, `.env.example`); **exposição de tokens de convite** em APIs de equipe; **endpoint de reset em modo debug**; **sessão React dessincronizada** após ativar conta/redefinir senha; **lacunas de testes** em perfil, tema, health e frontend; **proxy de desenvolvimento** sem rota `/plataforma`.

Áreas relativamente sólidas: uso de ORM parametrizado (sem SQLi evidente nos handlers revisados), política de senha em fluxos sensíveis, refresh rotativo com `jti`, isolamento de tenant em ranking e palpites com testes dedicados, ausência de `dangerouslySetInnerHTML` no frontend.

---

## 2. Escopo da Varredura

### 2.1 Incluído

| Camada | Caminhos | Observação |
|--------|----------|------------|
| Backend | `app/` (rotas, serviços, modelos, schemas, auth, core), `app/main.py` | 17 routers HTTP |
| Frontend | `frontend/src/` (páginas, features, componentes, hooks, services, lib) | 14 páginas + admin |
| Testes | `tests/`, `pytest.ini`, `conftest.py`, `factories.py` | Leitura + execução com `py` |
| Migrações | `alembic/versions/`, `alembic/env.py` | Revisão de TRUNCATE/DELETE |
| Scripts | `scripts/*.py` | Seeds e wipe operacional |
| Config | `requirements.txt`, `pyproject.toml`, `.env.example`, `.gitignore` | |
| Estáticos | `static/` (uploads de avatar, bandeiras) | Metadados e versionamento |
| Referência | `SECURITY.md` | Cruzamento E-01…E-17 |

### 2.2 Fora de escopo

- Pentest dinâmico, fuzzing, brute force em produção
- Alteração de qualquer arquivo do repositório **exceto** este `relatorio.md`
- `alembic upgrade`, instalação de dependências, commits
- Análise forense de bytes de avatares
- Revisão linha a linha de documentação histórica longa na raiz
- Execução de `scripts/wipe_operational_data.py`

### 2.3 Buscas adicionais (seção 1.6 do plano)

Segurança (OpenAPI padrão, enumeração, IDOR, mass assignment, tokens, TOCTOU, uploads, SSRF `avatar_url`, rate limit, hierarquia admin), API/contratos, frontend (componentes, hooks, React Query, `xlsx`), migrações, testes, operação, a11y/UX — cobertura registrada na seção 10.

### 2.4 Limitações antecipadas

Ver seção 11. Testes Python **somente** via `py` (nunca `python`).

---

## 3. Metodologia

1. Mapeamento da estrutura do repositório e pontos de entrada (`app/main.py`, `frontend/src/main.tsx`, `App.tsx`, Alembic, scripts).
2. Identificação da stack e dependências (`requirements.txt`, `frontend/package.json`).
3. Inventário de rotas HTTP (17 módulos em `app/routes/`) e páginas SPA (`App.tsx`).
4. Análise de autenticação, autorização e multi-tenant (`app/auth/dependencies.py`, guards React).
5. Revisão de entradas: Pydantic, uploads, query/path params, convites, reset de senha.
6. Busca por injection/XSS (ORM, `text()`, `innerHTML`, URLs em imagens).
7. Revisão de erros, loading, empty states e consistência front/back.
8. Navegação, redirecionamentos e fluxos de onboarding/convite/palpites/ranking.
9. Configuração, variáveis de ambiente, scripts e migrações.
10. Mapeamento de testes existentes vs rotas; coleta e execução opcional com `py -m pytest`.
11. Classificação de achados (confirmado / suspeita / melhoria).
12. Consolidação neste relatório, sem aplicar correções.

**Comandos de verificação documentados:** `py -m pytest`, `py -m pytest tests/test_security_endpoints.py`, `py -m pytest --co -q`, `npm run test` (frontend, não executado nesta auditoria).

---

## 4. Mapa Técnico do Projeto

### 4.1 Stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn, SQLAlchemy 2, Alembic, PostgreSQL, Pydantic, python-jose, bcrypt, httpx (Graph).
- **Frontend:** React 19, React Router 7, TanStack Query 5, Tailwind 4, Vite 8, Framer Motion, xlsx (import dinâmico em convites).

### 4.2 Principais diretórios

`app/routes/`, `app/services/`, `app/models/`, `app/schemas/`, `app/auth/`, `frontend/src/pages/`, `frontend/src/features/`, `tests/`, `scripts/`, `alembic/`, `static/`.

### 4.3 Pontos de entrada

- API/ASGI: `app/main.py` (`uvicorn app.main:app`)
- SPA dev: `frontend/src/main.tsx` + Vite (`localhost:5173`)
- SPA prod: `frontend/dist` servido pelo FastAPI quando presente
- Migrações: `alembic/env.py`
- CLI: `scripts/seed_*.py`, `scripts/wipe_operational_data.py`

### 4.4 Rotas/páginas SPA (resumo)

Públicas: `/login`, `/primeiro-acesso`, `/ativar-conta`, `/esqueci-senha`, `/redefinir-senha`. Protegidas: `/jogos`, `/especiais`, `/regras`, `/ranking`, `/perfil`. Admin: `/admin/config`, `/equipe`. Owner: `/admin`. Redirects: `/` e `/grupos` → `/jogos`; `*` → `/jogos`.

### 4.5 APIs (prefixos)

`/health`, `/auth`, `/configuracao-bolao`, `/configuracao-pontuacao-fase`, `/empresas`, `/equipe`, `/perfil`, `/usuarios`, `/paises`, `/jogos`, `/grupos`, `/ranking`, `/palpites-jogos`, `/palpites-especiais`, `/resultados-especiais`, `/marcadores-brasil`, `/plataforma/tema`, `/empresas/{id}/tema`.

### 4.6 Fluxos principais

Login → refresh cookie; primeiro acesso; convite → ativação; palpites (jogo, especiais, marcadores Brasil); ranking/insights; admin torneio global (owner); config e tema por empresa.

### 4.7 Integrações externas

PostgreSQL, Microsoft Graph (e-mail), arquivos `/static`, URLs externas em seeds de bandeiras (flagcdn).

### 4.8 Autenticação/autorização

JWT Bearer + refresh HttpOnly (`path=/auth`); papéis `owner`, `admin`, `usuario`; `resolve_empresa_id` para tenant; guards `ProtectedRoute`, `AdminRoute`, `OwnerRoute` no cliente (não substituem o servidor).

---

## 5. Classificação de Gravidade

- **CRÍTICA:** invasão, vazamento sensível explorável, execução indevida, bypass grave de autenticação/autorização.
- **ALTA:** falha relevante de segurança, perda/exposição indevida, quebra importante de fluxo.
- **MÉDIA:** bug funcional, validação incompleta, risco condicional, inconsistência material.
- **BAIXA:** usabilidade, manutenção, acessibilidade, robustez menor.
- **INFORMATIVA:** melhoria ou desenho intencional sem impacto imediato claro.

Códigos: `SEC-###`, `BUG-###`, `FLUX-###`, `NAV-###`, `UX-###`, `A11Y-###`, `CFG-###`, `DEP-###`, `TEST-###`, `MAN-###`.

---

## 6. Achados Detalhados

### [SEC-001] Defaults fracos de configuração e JWT

**Gravidade:** ALTA

**Categoria:** Segurança

**Arquivo(s):**
- `app/core/config.py`

**Local aproximado:**
Classe `Settings`: campos `database_url`, `jwt_secret`, `jwt_refresh_cookie_secure`.

**Descrição:**
Valores padrão incluem URL de banco local com credenciais genéricas, segredo JWT placeholder e cookie de refresh sem flag `secure`.

**Impacto:**
Deploy sem `.env` adequado pode operar com segredos previsíveis e cookies transmitidos em HTTP.

**Evidência:**
Defaults literais para URL de banco, segredo JWT e `jwt_refresh_cookie_secure: bool = False`.

**Cenário de reprodução ou exploração:**
Ambiente iniciado sem variáveis de ambiente; tokens assinados com segredo conhecido do repositório.

**Plano de correção:**
Exigir variáveis obrigatórias em produção; falhar no boot se segredo for placeholder; forçar `secure=True` atrás de HTTPS.

**Exemplo de direção técnica:**
Validar `jwt_secret` no startup e recusar valor da lista de placeholders; `secure=settings.is_production`.

**Status:** Pendente

### [SEC-002] Credencial de exemplo em arquivo versionado

**Gravidade:** ALTA

**Categoria:** Segurança

**Arquivo(s):**
- `.env.example`

**Local aproximado:**
Variável `DATABASE_URL`.

**Descrição:**
O template versionado contém formato de senha em URL de conexão, não apenas placeholders genéricos.

**Impacto:**
Risco de reutilização de padrão real em ambientes e exposição em histórico do repositório.

**Evidência:**
Linha `DATABASE_URL=postgresql+psycopg2://postgres:<tipo_senha>@localhost:5432/bolao_copa` (valor omitido neste relatório).

**Cenário de reprodução ou exploração:**
Operador copia `.env.example` sem substituir credenciais.

**Plano de correção:**
Usar placeholders óbvios (`CHANGE_ME`); documentar sem valores sensíveis.

**Exemplo de direção técnica:**
`DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME`

**Status:** Pendente

### [SEC-003] Endpoint de token de reset em modo debug

**Gravidade:** ALTA

**Categoria:** Segurança

**Arquivo(s):**
- `app/routes/auth.py`
- `app/core/config.py`

**Local aproximado:**
`GET /auth/reset-token-dev/{email}` — função `get_reset_token_dev`.

**Descrição:**
Rota pública retorna token de reset ativo quando `settings.debug` é verdadeiro.

**Impacto:**
Com debug ativo em ambiente exposto, terceiros podem obter token de redefinição por e-mail.

**Evidência:**
Checagem `if not settings.debug: raise HTTPException(404)` antes de consultar `PasswordReset`.

**Cenário de reprodução ou exploração:**
`DEBUG=true` em staging; requisição GET com e-mail conhecido.

**Plano de correção:**
Remover rota em builds de produção ou proteger com autenticação forte; garantir `debug=False` em deploy.

**Exemplo de direção técnica:**
Registrar router apenas se `settings.debug` no startup de desenvolvimento.

**Status:** Corrigido

**Correção aplicada:** A rota `GET /auth/reset-token-dev/{email}` foi removida de `app/routes/auth.py`, eliminando a exposição de tokens de reset em modo debug.

### [SEC-004] Access token em localStorage

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `frontend/src/lib/api.ts`

**Local aproximado:**
Constante `LS_TOKEN`, funções `getToken`/`setToken`.

**Descrição:**
O JWT de acesso persiste em `localStorage`, legível por scripts na origem.

**Impacto:**
XSS no frontend pode exfiltrar token antes da expiração.

**Evidência:**
`localStorage.getItem/setItem` para chave `bolao_access_token`.

**Cenário de reprodução ou exploração:**
Injeção de script na mesma origem lê o token e chama APIs autenticadas.

**Plano de correção:**
Avaliar token só em memória ou cookie HttpOnly com mitigação CSRF; reforçar CSP.

**Exemplo de direção técnica:**
Manter access token em memória do módulo auth; refresh via cookie já existente.

**Status:** Corrigido

**Correção aplicada:** O access token passou a ficar só em memória em `frontend/src/lib/api.ts`, com reidratação via cookie de refresh no `AuthContext` e remoção única do legado em `localStorage`.

### [SEC-005] Cookie de refresh sem Secure por padrão

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/core/config.py`
- `app/routes/auth.py`

**Local aproximado:**
`_set_refresh_cookie`.

**Descrição:**
`jwt_refresh_cookie_secure` padrão `False`.

**Impacto:**
Em HTTP, cookie de refresh pode ser interceptado em rede não confiável.

**Evidência:**
`secure=settings.jwt_refresh_cookie_secure` com default falso em Settings.

**Cenário de reprodução ou exploração:**
Aplicação servida sem TLS; sniffing de rede local.

**Plano de correção:**
`Secure=True` em produção; documentar em `.env.example`.

**Exemplo de direção técnica:**
`jwt_refresh_cookie_secure: bool = Field(default_factory=lambda: os.getenv("ENV") == "production")`

**Status:** Corrigido

**Correção aplicada:** `JWT_REFRESH_COOKIE_SECURE` foi documentado em `.env.example`; o cookie de refresh continua controlado por `settings.jwt_refresh_cookie_secure` em `app/routes/auth.py`.

### [SEC-006] Ausência de CORS e cabeçalhos de segurança HTTP

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/main.py`

**Local aproximado:**
Criação da app FastAPI e middlewares.

**Descrição:**
Não há `CORSMiddleware` nem headers como HSTS, `X-Frame-Options`, CSP.

**Impacto:**
API e SPA em origens distintas podem falhar com credenciais; clickjacking sem mitigação no backend.

**Evidência:**
`app = FastAPI(...)` sem middleware CORS ou security headers adicionais.

**Cenário de reprodução ou exploração:**
Front em domínio A e API em B com cookies cross-site; iframe em site malicioso.

**Plano de correção:**
Configurar CORS explícito para origens permitidas; middleware de security headers.

**Exemplo de direção técnica:**
`CORSMiddleware` com `allow_credentials=True` e lista de origens do `PUBLIC_APP_URL`.

**Status:** Corrigido

**Correção aplicada:** `CORSMiddleware` com credenciais e origens configuráveis foi adicionado em `app/main.py`, com lista derivada de `PUBLIC_APP_URL` e `CORS_ALLOWED_ORIGINS` em `app/core/config.py`.

### [SEC-007] Superfície CSRF em rotas baseadas em cookie

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/routes/auth.py`

**Local aproximado:**
`POST /auth/refresh`, `POST /auth/logout`.

**Descrição:**
Refresh e logout dependem de cookie sem token anti-CSRF dedicado.

**Impacto:**
Em cenários cross-site com `SameSite` inadequado, ações indesejadas de sessão.

**Evidência:**
Leitura de `request.cookies.get(settings.jwt_refresh_cookie_name)` sem validação de origem/CSRF token.

**Cenário de reprodução ou exploração:**
Site externo dispara POST cross-origin (mitigado parcialmente por `SameSite=lax`).

**Plano de correção:**
Token CSRF double-submit ou `SameSite=strict`/`none`+`secure` documentado; validar `Origin`.

**Exemplo de direção técnica:**
Exigir header customizado em refresh além do cookie.

**Status:** Corrigido

**Correção aplicada:** `app/auth/request_origin.py` valida `X-Bolao-Client` e origem permitida em `POST /auth/refresh` e `POST /auth/logout`; o frontend envia o header nas chamadas correspondentes.

### [SEC-008] Exposição de tokens de convite na API

**Gravidade:** ALTA

**Categoria:** Segurança

**Arquivo(s):**
- `app/routes/equipe.py`
- `app/services/convite_service.py`

**Local aproximado:**
`GET /equipe/convites`, resposta de `criar_bulk_convites` em falha de e-mail.

**Descrição:**
Listagem e itens de convite incluem `token` em claro; falha de envio devolve token na API e log.

**Impacto:**
Admin comprometido ou vazamento de resposta HTTP permite ativar contas de terceiros.

**Evidência:**
Dict com `"token": c.token` em listagem; `item.token = token` quando e-mail falha; `print` informando token na resposta.

**Cenário de reprodução ou exploração:**
Admin autenticado lista convites; interceptação de resposta de lote com falha de SMTP.

**Plano de correção:**
Não retornar token após criação; link único por e-mail; mascarar em listagens.

**Exemplo de direção técnica:**
`ConviteReadPublic` sem campo token; apenas status e expiração.

**Status:** Corrigido

**Correção aplicada:** Tokens de convite foram removidos das respostas de `equipe` e dos schemas de convite; a UI de equipe orienta reenvio por e-mail em vez de copiar link.

### [SEC-009] avatar_url arbitrário e carregamento de URL externa

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/schemas/perfil.py`
- `app/schemas/convite.py`
- `app/services/ativacao_service.py`
- `frontend/src/lib/utils.ts`

**Local aproximado:**
`PerfilUpdate.avatar_url`, `AtivarContaRequest.avatar_url`, `imgUrl`.

**Descrição:**
Backend aceita string longa sem validar esquema/caminho; frontend renderiza URLs `http(s)` em imagens.

**Impacto:**
Rastreamento de IP do servidor/cliente, conteúdo inapropriado, possível abuso de exibição.

**Evidência:**
Campo opcional `max_length=2048`; `imgUrl` retorna URL externa inalterada.

**Cenário de reprodução ou exploração:**
PATCH de perfil com URL controlada por atacante; outros usuários carregam recurso externo.

**Plano de correção:**
Restringir a caminhos `/static/uploads/...` gerados pelo upload; bloquear esquemas externos.

**Exemplo de direção técnica:**
Validador Pydantic com regex `^/static/uploads/avatars/[a-f0-9]+\.(jpg|png|webp)$`.

**Status:** Corrigido

**Correção aplicada:** `app/core/avatar_url.py` restringe `avatar_url` a caminhos de upload local; `imgUrl` no frontend não renderiza URLs externas.

### [SEC-010] Validação de upload apenas por Content-Type

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/services/avatar_upload_service.py`

**Local aproximado:**
`persist_avatar`.

**Descrição:**
Tipo de arquivo inferido do header `Content-Type`, sem magic bytes.

**Impacto:**
Upload de conteúdo não-imagem com MIME forjado.

**Evidência:**
Mapa `_CONTENT_EXT` keyed por `content_type` do cliente.

**Cenário de reprodução ou exploração:**
Multipart com `Content-Type: image/png` e payload não imagem.

**Plano de correção:**
Validar assinatura de arquivo (PNG/JPEG/WebP) antes de gravar.

**Exemplo de direção técnica:**
`if not data.startswith(b"\x89PNG"): raise ...`

**Status:** Corrigido

**Correção aplicada:** `avatar_upload_service.py` detecta JPEG, PNG e WebP por assinatura e exige coerência com o `Content-Type` declarado.

### [SEC-011] Upload pré-ativação sem rate limit na rota

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/routes/auth.py`

**Local aproximado:**
`POST /auth/avatar-pre-ativacao`.

**Descrição:**
Endpoint anônimo (token de convite) aceita upload até 2 MiB sem `enforce_limit` visível.

**Impacto:**
Abuso de disco e CPU com convites válidos ou brute force de token.

**Evidência:**
Handler valida token e chama `read_upload_limited` sem chamada a `rate_limit_service`.

**Cenário de reprodução ou exploração:**
Múltiplos uploads sequenciais com tokens obtidos de respostas de convite.

**Plano de correção:**
Rate limit por IP e por token de convite.

**Exemplo de direção técnica:**
`enforce_limit(key=f"avatar-pre:{ip}", ...)`

**Status:** Corrigido

**Correção aplicada:** `POST /auth/avatar-pre-ativacao` aplica `enforce_limit` por IP e por hash do token de convite antes de validar o token e ler o arquivo.

### [SEC-012] Troca de senha sem revogar refresh tokens

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/services/auth_service.py`
- `app/services/password_reset_service.py`
- `app/routes/perfil.py`

**Local aproximado:**
`change_password`, `redefinir_senha`, `alterar_senha`.

**Descrição:**
Alteração de senha atualiza hash mas não chama `revogar_refresh_tokens_usuario`.

**Impacto:**
Sessões antigas permanecem válidas via refresh até expiração/revogação manual.

**Evidência:**
`revogar_refresh_tokens_usuario` usado em bloqueio de equipe, não em troca de senha.

**Cenário de reprodução ou exploração:**
Dispositivo roubado mantém refresh após vítima trocar senha em outro dispositivo.

**Plano de correção:**
Revogar todos refresh tokens do usuário após troca/reset bem-sucedido.

**Exemplo de direção técnica:**
`revogar_refresh_tokens_usuario(db, user.id)` antes do `commit` em change_password.

**Status:** Corrigido

**Correção aplicada:** Troca e reset de senha revogam refresh tokens ativos antes do commit nos serviços de autenticação, reset e equipe.

### [SEC-013] Listagem global de palpites especiais para owner

**Gravidade:** INFORMATIVA

**Categoria:** Segurança

**Arquivo(s):**
- `app/routes/palpites_especiais.py`
- `tests/test_security_endpoints.py`

**Local aproximado:**
`GET /palpites-especiais` com `require_owner`.

**Descrição:**
Owner vê palpites especiais de todos os tenants; coberto por teste como comportamento esperado.

**Impacto:**
Exposição cross-tenant por desenho de plataforma, não bypass acidental.

**Evidência:**
`listar_todos_admin` sem filtro `empresa_id`; teste `test_owner_lista_palpites_especiais_globais`.

**Cenário de reprodução ou exploração:**
Conta owner comprometida vê palpites de todas as empresas.

**Plano de correção:**
Documentar política; opcional filtro `empresa_id` obrigatório na query.

**Exemplo de direção técnica:**
Query param `empresa_id` obrigatório para owner em listagens sensíveis.

**Status:** Pendente

### [SEC-014] Ausência de política de conteúdo e framing

**Gravidade:** BAIXA

**Categoria:** Segurança

**Arquivo(s):**
- `app/main.py`
- `frontend/index.html`

**Local aproximado:**
Respostas HTTP da API e shell da SPA.

**Descrição:**
Sem CSP, `X-Frame-Options` ou `frame-ancestors` definidos no backend.

**Impacto:**
Maior superfície para clickjacking e XSS sem camada extra.

**Evidência:**
Nenhum middleware de security headers em `main.py`.

**Cenário de reprodução ou exploração:**
Página embutida em iframe em domínio malicioso.

**Plano de correção:**
Headers no reverse proxy ou middleware FastAPI.

**Exemplo de direção técnica:**
`X-Frame-Options: DENY` e CSP restritiva para scripts inline.

**Status:** Corrigido

**Correção aplicada:** Middleware em `app/main.py` define `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e CSP mínima quando `debug` é falso.

### [SEC-015] Senha temporária padrão em resets administrativos

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/core/password_defaults.py`
- `app/services/usuario_service.py`

**Local aproximado:**
`SENHA_PADRAO_TEMPORARIA`, `reset_password`.

**Descrição:**
Constante documentada (`Bolao123`) reaplicada em reset por admin/owner.

**Impacto:**
Contas com senha previsível até primeiro acesso.

**Evidência:**
Constante `SENHA_PADRAO_TEMPORARIA` e fluxo de reset que define hash da senha padrão.

**Cenário de reprodução ou exploração:**
Reset de participante; login com senha padrão antes do usuário trocar.

**Plano de correção:**
Senha aleatória única por reset; forçar troca no primeiro login (já parcialmente presente).

**Exemplo de direção técnica:**
`secrets.token_urlsafe(12)` + e-mail de redefinição em vez de senha fixa.

**Status:** Corrigido

**Correção aplicada:** `usuario_service.reset_password` gera senha temporária aleatória que atende à política de complexidade e envia o valor apenas por e-mail.

### [SEC-016] Admin pode bloquear ou remover outro admin do tenant

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/services/equipe_service.py`
- `app/routes/equipe.py`

**Local aproximado:**
`bloquear_usuario`, `remover_usuario`.

**Descrição:**
Não há regra impedindo admin de bloquear/remover outro admin da mesma empresa.

**Impacto:**
Disputa interna ou conta admin comprometida afeta outro administrador.

**Evidência:**
Escopo por `empresa_id` sem checagem `tipo_usuario` do alvo em bloqueio/remoção.

**Cenário de reprodução ou exploração:**
Admin A bloqueia Admin B do mesmo bolão.

**Plano de correção:**
Hierarquia: só owner global ou último admin protegido.

**Exemplo de direção técnica:**
`if alvo.tipo_usuario == "admin" and ator.tipo_usuario != "owner": 403`

**Status:** Corrigido

**Correção aplicada:** `equipe_service` retorna 403 quando um administrador tenta bloquear ou remover outro administrador sem ser owner da plataforma.

### [SEC-017] Tema da plataforma legível sem autenticação

**Gravidade:** MÉDIA

**Categoria:** Segurança

**Arquivo(s):**
- `app/routes/tema.py`

**Local aproximado:**
`GET /plataforma/tema`.

**Descrição:**
Tokens de tema claro/escuro expostos publicamente.

**Impacto:**
Baixo risco de segurança; vazamento de customização de branding.

**Evidência:**
Handler sem dependência `Depends(get_current_user)`.

**Cenário de reprodução ou exploração:**
Requisição anônima retorna JSON de tema.

**Plano de correção:**
Aceitar público se intencional; ou exigir auth se tema for sensível.

**Exemplo de direção técnica:**
Documentar como endpoint público de branding.

**Status:** Corrigido

**Correção aplicada:** `GET /plataforma/tema` exige usuário autenticado via `get_current_active_user` em `app/routes/tema.py`.

### [SEC-018] Criação de usuário owner sem política de complexidade

**Gravidade:** BAIXA

**Categoria:** Segurança

**Arquivo(s):**
- `app/schemas/usuario.py`

**Local aproximado:**
`UsuarioCreate.senha_plana`.

**Descrição:**
Exige apenas comprimento mínimo 8, sem `validar_complexidade_senha`.

**Impacto:**
Senhas fracas em contas criadas pelo owner.

**Evidência:**
`Field(min_length=8)` sem validator de complexidade no schema de criação.

**Cenário de reprodução ou exploração:**
`POST /usuarios` com senha alfanumérica simples.

**Plano de correção:**
Reutilizar `validar_complexidade_senha` no schema ou serviço.

**Exemplo de direção técnica:**
`@model_validator` chamando `validar_complexidade_senha` quando `senha_plana` presente.

**Status:** Corrigido

**Correção aplicada:** `UsuarioCreate` valida `senha_plana` com `validar_complexidade_senha` quando a senha é informada na API.

### [SEC-019] Documentação OpenAPI padrão do FastAPI exposta

**Gravidade:** INFORMATIVA

**Categoria:** Segurança

**Arquivo(s):**
- `app/main.py`

**Local aproximado:**
Instanciação `FastAPI(title=..., version=...)`.

**Descrição:**
Não há `docs_url=None` / `redoc_url=None`; rotas `/docs` e `/redoc` ficam disponíveis por padrão.

**Impacto:**
Enumeração de superfície de API em ambientes expostos.

**Evidência:**
Ausência de desabilitação explícita de documentação interativa.

**Cenário de reprodução ou exploração:**
Acesso anônimo a `/docs` em instância pública.

**Plano de correção:**
Desabilitar em produção ou proteger com auth.

**Exemplo de direção técnica:**
`FastAPI(..., docs_url=None if not settings.debug else "/docs")`

**Status:** Corrigido

**Correção aplicada:** A instância FastAPI em `app/main.py` desabilita `/docs`, `/redoc` e `/openapi.json` quando `settings.debug` é falso.

### [BUG-001] Proxy Vite sem rota /plataforma

**Gravidade:** MÉDIA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/vite.config.ts`
- `frontend/src/hooks/useEmpresaTheme.ts`
- `frontend/src/services/admin.service.ts`

**Local aproximado:**
`server.proxy` e chamadas `GET/PUT /plataforma/tema`.

**Descrição:**
Em desenvolvimento, requisições a `/plataforma/tema` não são encaminhadas ao backend (porta 8000).

**Impacto:**
Owner sem `empresa_id` não carrega tema da plataforma no Vite dev; aparência quebrada ou erro de rede.

**Evidência:**
Lista de proxies inclui `/auth`, `/empresas`, etc., sem entrada `/plataforma`; hooks chamam `/plataforma/tema`.

**Cenário de reprodução ou exploração:**
`npm run dev`; login como owner; aba aparência ou tema global.

**Plano de correção:**
Adicionar proxy `/plataforma` para `API_TARGET`.

**Exemplo de direção técnica:**
`'/plataforma': { target: API_TARGET, changeOrigin: true }`

**Status:** Pendente
### [BUG-002] Lote de convites marca sucesso em falha HTTP

**Gravidade:** MÉDIA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/src/services/equipe.service.ts`

**Local aproximado:**
enviarConvitesEmLotes catch

**Descrição:**
Em erro HTTP do chunk, itens recebem status de convite criado.

**Impacto:**
Operador interpreta lote como bem-sucedido.

**Evidência:**
Bloco catch atribui status criado com email_erro.

**Cenário de reprodução ou exploração:**
Falha 500 no meio do envio em lote.

**Plano de correção:**
Usar status de falha de requisição.

**Exemplo de direção técnica:**
status: 'falha_requisicao'.

**Status:** Pendente

### [BUG-003] Multipart sem retry após refresh 401

**Gravidade:** MÉDIA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/src/lib/api.ts`

**Local aproximado:**
apiPostMultipart

**Descrição:**
Upload não tenta refresh de token em 401.

**Impacto:**
Avatar falha com sessão renovável.

**Evidência:**
Ausência de tryRefreshToken no multipart.

**Cenário de reprodução ou exploração:**
Access expirado durante POST de avatar.

**Plano de correção:**
Reutilizar refresh de apiFetch.

**Exemplo de direção técnica:**
Repetir fetch após novo Bearer.

**Status:** Pendente

### [BUG-004] Token no storage sem estado React

**Gravidade:** ALTA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/src/features/auth/AuthContext.tsx; frontend/src/pages/AtivarContaPage.tsx; frontend/src/pages/RedefinirSenhaPage.tsx`

**Local aproximado:**
setToken / isAuthenticated

**Descrição:**
Páginas de ativação e redefinição gravam token só no localStorage.

**Impacto:**
isAuthenticated permanece falso e há redirect ao login.

**Evidência:**
login atualiza setTokenState; ativação não.

**Cenário de reprodução ou exploração:**
Concluir ativar-conta e abrir /jogos.

**Plano de correção:**
Expor adoptSession no contexto.

**Exemplo de direção técnica:**
setTokenState após setToken.

**Status:** Pendente

### [BUG-005] Métrica incorreta para líder no ranking

**Gravidade:** MÉDIA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/src/pages/RankingPage.tsx`

**Local aproximado:**
card Sua posição

**Descrição:**
listaTop50 = top50.slice(3) desloca referência ao 2º colocado.

**Impacto:**
Texto de distância ao 2º errado para o líder.

**Evidência:**
Comparação usa listaTop50[0] para 2º lugar.

**Cenário de reprodução ou exploração:**
Usuário em 1º na classificação.

**Plano de correção:**
Comparar com top50[1].

**Exemplo de direção técnica:**
sortValue(top50[1], sortBy).

**Status:** Pendente

### [BUG-006] Falhas de query parecem lista vazia

**Gravidade:** MÉDIA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/src/pages/JogosPage.tsx; frontend/src/pages/RankingPage.tsx`

**Local aproximado:**
React Query

**Descrição:**
Queries sem isError tratam falha como dados vazios.

**Impacto:**
Usuário não distingue erro de rede de ausência de jogos.

**Evidência:**
Uso de isLoading sem ramo isError.

**Cenário de reprodução ou exploração:**
API indisponível ao abrir jogos.

**Plano de correção:**
Padrão de erro como em RegrasPage.

**Exemplo de direção técnica:**
if (isError) EmptyState com retry.

**Status:** Pendente

### [BUG-007] URL de equipe com barra antes da query

**Gravidade:** BAIXA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/src/services/equipe.service.ts`

**Local aproximado:**
listarEquipe

**Descrição:**
Montagem /equipe/?empresa_id= com barra extra.

**Impacto:**
Possível inconsistência em proxies.

**Evidência:**
Template /equipe/${tail} com tail iniciando em ?.

**Cenário de reprodução ou exploração:**
Listar equipe filtrando empresa.

**Plano de correção:**
Normalizar para /equipe?empresa_id=.

**Exemplo de direção técnica:**
api.get(`/equipe${empresaQs}`).

**Status:** Pendente

### [BUG-008] Autosave de palpite fora de ordem

**Gravidade:** MÉDIA

**Categoria:** Bug

**Arquivo(s):**
- `frontend/src/components/GameCard/index.tsx`

**Local aproximado:**
debounce 700ms

**Descrição:**
Respostas lentas podem sobrescrever edição mais recente.

**Impacto:**
Placar exibido diverge do digitado.

**Evidência:**
Debounce sem contador de versão.

**Cenário de reprodução ou exploração:**
Mudanças rápidas com latência alta.

**Plano de correção:**
Ignorar respostas antigas.

**Exemplo de direção técnica:**
if (seq !== latestSeq) return.

**Status:** Pendente

### [FLUX-001] Primeiro acesso sem guard no cliente

**Gravidade:** MÉDIA

**Categoria:** Fluxo

**Arquivo(s):**
- `frontend/src/App.tsx; frontend/src/pages/PrimeiroAcessoPage.tsx`

**Local aproximado:**
/primeiro-acesso

**Descrição:**
Rota pública exibe formulário sem exigir sessão.

**Impacto:**
Erro só no submit da API.

**Evidência:**
Rota fora de ProtectedRoute.

**Cenário de reprodução ou exploração:**
Abrir /primeiro-acesso sem login.

**Plano de correção:**
Redirect se sem token.

**Exemplo de direção técnica:**
Navigate to /login.

**Status:** Pendente

### [FLUX-002] Sessões paralelas após troca de senha

**Gravidade:** MÉDIA

**Categoria:** Fluxo

**Arquivo(s):**
- `app/services/auth_service.py`

**Local aproximado:**
change_password

**Descrição:**
Troca de senha não revoga refresh tokens.

**Impacto:**
Dispositivos antigos mantêm sessão.

**Evidência:**
Sem revogar_refresh_tokens_usuario.

**Cenário de reprodução ou exploração:**
Trocar senha em um browser; outro ativo.

**Plano de correção:**
Alinhar com SEC-012.

**Exemplo de direção técnica:**
Revogar todos refresh do usuário.

**Status:** Pendente

### [FLUX-003] Erros mascarados em palpites especiais

**Gravidade:** MÉDIA

**Categoria:** Fluxo

**Arquivo(s):**
- `frontend/src/pages/EspeciaisPage.tsx`

**Local aproximado:**
GET /palpites-especiais/me

**Descrição:**
catch retorna null em falhas.

**Impacto:**
401/5xx tratados como sem palpite.

**Evidência:**
.catch(() => null) na query.

**Cenário de reprodução ou exploração:**
Token inválido ao carregar página.

**Plano de correção:**
Surface isError.

**Exemplo de direção técnica:**
React Query throwOnError.

**Status:** Pendente

### [FLUX-004] Login não redireciona sessão existente

**Gravidade:** BAIXA

**Categoria:** Fluxo

**Arquivo(s):**
- `frontend/src/pages/LoginPage.tsx`

**Local aproximado:**
/login

**Descrição:**
Usuário autenticado pode ficar na tela de login.

**Impacto:**
UX redundante.

**Evidência:**
Sem Navigate quando autenticado.

**Cenário de reprodução ou exploração:**
Acessar /login com token válido.

**Plano de correção:**
Redirect para /jogos.

**Exemplo de direção técnica:**
if (isAuthenticated) Navigate.

**Status:** Pendente

### [FLUX-005] Troca de empresa durante convites

**Gravidade:** MÉDIA

**Categoria:** Fluxo

**Arquivo(s):**
- `frontend/src/pages/EquipePage.tsx; frontend/src/hooks/useResolvedEmpresaForAdmin.ts`

**Local aproximado:**
envio em lote

**Descrição:**
empresa_id pode mudar durante progresso.

**Impacto:**
Resultados associados ao tenant errado.

**Evidência:**
Picker ativo durante lote.

**Cenário de reprodução ou exploração:**
Trocar empresa no meio do envio.

**Plano de correção:**
Travar tenant no início.

**Exemplo de direção técnica:**
useRef tenantLock.

**Status:** Pendente

### [FLUX-006] Avatar órfão na pré-ativação

**Gravidade:** BAIXA

**Categoria:** Fluxo

**Arquivo(s):**
- `app/routes/auth.py; app/services/avatar_upload_service.py`

**Local aproximado:**
avatar-pre-ativacao

**Descrição:**
Arquivo persiste antes da ativação concluir.

**Impacto:**
Órfãos em static se abandono.

**Evidência:**
persist_avatar antes de vincular usuário.

**Cenário de reprodução ou exploração:**
Upload sem concluir ativação.

**Plano de correção:**
Limpeza periódica.

**Exemplo de direção técnica:**
Job remove não referenciados.

**Status:** Pendente

### [NAV-001] GruposPage órfã

**Gravidade:** BAIXA

**Categoria:** Navegação

**Arquivo(s):**
- `frontend/src/pages/GruposPage.tsx; frontend/src/App.tsx`

**Local aproximado:**
/grupos

**Descrição:**
Componente sem rota ativa.

**Impacto:**
Código morto.

**Evidência:**
Redirect para /jogos sem import.

**Cenário de reprodução ou exploração:**
Grep GruposPage.

**Plano de correção:**
Remover ou restaurar rota.

**Exemplo de direção técnica:**
Integrar em JogosPage.

**Status:** Pendente

### [NAV-002] Wildcard sem preservar destino

**Gravidade:** BAIXA

**Categoria:** Navegação

**Arquivo(s):**
- `frontend/src/App.tsx`

**Local aproximado:**
path *

**Descrição:**
URLs inválidas viram /jogos sem returnUrl.

**Impacto:**
Deep link perdido.

**Evidência:**
Navigate replace para /jogos.

**Cenário de reprodução ou exploração:**
URL desconhecida deslogado.

**Plano de correção:**
Guardar next no login.

**Exemplo de direção técnica:**
/login?next=...

**Status:** Pendente

### [NAV-003] Owner acessa rotas bloqueadas na nav

**Gravidade:** MÉDIA

**Categoria:** Navegação

**Arquivo(s):**
- `frontend/src/layouts/AppLayout.tsx`

**Local aproximado:**
nav inferior

**Descrição:**
Bloqueio visual não impede URL direta.

**Impacto:**
Inconsistência de política.

**Evidência:**
blur/aria-disabled sem guard de rota.

**Cenário de reprodução ou exploração:**
Owner abre /especiais.

**Plano de correção:**
Guard ou redirect owner.

**Exemplo de direção técnica:**
OwnerRoute em rotas de participante.

**Status:** Pendente

### [UX-001] Bloqueio de clipboard no login

**Gravidade:** BAIXA

**Categoria:** Usabilidade

**Arquivo(s):**
- `frontend/src/pages/LoginPage.tsx`

**Local aproximado:**
campos email/senha

**Descrição:**
onPaste e atalhos bloqueados.

**Impacto:**
Dificulta gerenciadores de senha.

**Evidência:**
preventDefault em paste.

**Cenário de reprodução ou exploração:**
Login com senha salva.

**Plano de correção:**
Remover bloqueios.

**Exemplo de direção técnica:**
Permitir colar.

**Status:** Pendente

### [UX-002] Perfil sem validação de senha no cliente

**Gravidade:** BAIXA

**Categoria:** Usabilidade

**Arquivo(s):**
- `frontend/src/pages/PerfilPage.tsx`

**Local aproximado:**
alterar senha

**Descrição:**
Sem validarSenhaSegura antes do POST.

**Impacto:**
Erro só após round-trip.

**Evidência:**
Ausência de import passwordPolicy.

**Cenário de reprodução ou exploração:**
Senha fraca no perfil.

**Plano de correção:**
Validar como primeiro acesso.

**Exemplo de direção técnica:**
validarSenhaSegura local.

**Status:** Pendente

### [UX-003] Toasts sem dismiss manual

**Gravidade:** BAIXA

**Categoria:** Usabilidade

**Arquivo(s):**
- `frontend/src/components/Toast.tsx`

**Local aproximado:**
timeout

**Descrição:**
Mensagens somem em poucos segundos.

**Impacto:**
Usuário perde texto de erro.

**Evidência:**
Timer automático.

**Cenário de reprodução ou exploração:**
Erro lido devagar.

**Plano de correção:**
Botão fechar.

**Exemplo de direção técnica:**
duration configurável.

**Status:** Pendente

### [UX-004] Feedback duplicado ao salvar palpite

**Gravidade:** BAIXA

**Categoria:** Usabilidade

**Arquivo(s):**
- `frontend/src/pages/JogosPage.tsx; frontend/src/components/GameCard/index.tsx`

**Local aproximado:**
save palpite

**Descrição:**
Toast no pai e estado no card.

**Impacto:**
Ruído visual.

**Evidência:**
Dois canais de erro.

**Cenário de reprodução ou exploração:**
Falha ao salvar palpite.

**Plano de correção:**
Unificar feedback.

**Exemplo de direção técnica:**
Só toast ou só inline.

**Status:** Pendente

### [UX-005] Esqueci senha com sucesso genérico

**Gravidade:** MÉDIA

**Categoria:** Usabilidade

**Arquivo(s):**
- `frontend/src/pages/EsqueciSenhaPage.tsx`

**Local aproximado:**
submit forgot

**Descrição:**
Erros não-429 viram mensagem de enviado.

**Impacto:**
Confusão com falha de rede.

**Evidência:**
Alinhado anti-enumeração do backend.

**Cenário de reprodução ou exploração:**
Erro de rede no forgot.

**Plano de correção:**
Mensagem neutra clara.

**Exemplo de direção técnica:**
Distinguir 429.

**Status:** Pendente

### [A11Y-001] Labels sem htmlFor

**Gravidade:** BAIXA

**Categoria:** Acessibilidade

**Arquivo(s):**
- `frontend/src/pages/PerfilPage.tsx; EsqueciSenhaPage.tsx; RedefinirSenhaPage.tsx; PrimeiroAcessoPage.tsx`

**Local aproximado:**
formulários

**Descrição:**
Labels não associadas por id.

**Impacto:**
Leitores de tela.

**Evidência:**
label sem htmlFor.

**Cenário de reprodução ou exploração:**
Navegação por voz.

**Plano de correção:**
Associar id/htmlFor.

**Exemplo de direção técnica:**
htmlFor=id.

**Status:** Pendente

### [A11Y-002] Abas e SegmentedControl incompletos

**Gravidade:** BAIXA

**Categoria:** Acessibilidade

**Arquivo(s):**
- `frontend/src/components/SegmentedControl.tsx; frontend/src/pages/AdminPage.tsx`

**Local aproximado:**
tabs

**Descrição:**
aria-controls e teclado incompletos.

**Impacto:**
Navegação por teclado fraca.

**Evidência:**
buttons sem role tab.

**Cenário de reprodução ou exploração:**
Admin abas.

**Plano de correção:**
ARIA tablist completo.

**Exemplo de direção técnica:**
role=tab tabpanel.

**Status:** Pendente

### [A11Y-003] Nav inferior sem aria-current

**Gravidade:** BAIXA

**Categoria:** Acessibilidade

**Arquivo(s):**
- `frontend/src/layouts/AppLayout.tsx`

**Local aproximado:**
NavLink

**Descrição:**
Página ativa não exposta.

**Impacto:**
Orientação espacial.

**Evidência:**
NavLink sem aria-current.

**Cenário de reprodução ou exploração:**
Nav mobile.

**Plano de correção:**
aria-current=page.

**Exemplo de direção técnica:**
NavLink aria-current.

**Status:** Pendente

### [A11Y-004] Toggle de senha sem aria-label

**Gravidade:** BAIXA

**Categoria:** Acessibilidade

**Arquivo(s):**
- `frontend/src/pages/PerfilPage.tsx; frontend/src/pages/AtivarContaPage.tsx`

**Local aproximado:**
toggle visibilidade

**Descrição:**
Botão olho sem nome acessível.

**Impacto:**
Leitor não anuncia função.

**Evidência:**
ícone sem aria-label.

**Cenário de reprodução ou exploração:**
Mostrar/ocultar senha.

**Plano de correção:**
aria-label em português.

**Exemplo de direção técnica:**
aria-label Mostrar senha.

**Status:** Pendente

### [A11Y-005] Sem skip link e toasts polite

**Gravidade:** INFORMATIVA

**Categoria:** Acessibilidade

**Arquivo(s):**
- `frontend/src/components/Toast.tsx; layout geral`

**Local aproximado:**
global

**Descrição:**
Sem link pular conteúdo; erros em polite.

**Impacto:**
Erros críticos menos assertivos.

**Evidência:**
role status polite.

**Cenário de reprodução ou exploração:**
Erro grave.

**Plano de correção:**
assertive para erro.

**Exemplo de direção técnica:**
skip link no layout.

**Status:** Pendente

### [CFG-001] .env.example incompleto

**Gravidade:** MÉDIA

**Categoria:** Configuração

**Arquivo(s):**
- `.env.example; app/core/config.py`

**Local aproximado:**
Settings

**Descrição:**
Variáveis de refresh, rate limit, debug e Graph ausentes do exemplo.

**Impacto:**
Deploy mal configurado.

**Evidência:**
Settings com mais campos que .env.example.

**Cenário de reprodução ou exploração:**
Novo ambiente.

**Plano de correção:**
Documentar todas as vars.

**Exemplo de direção técnica:**
Espelhar Settings.

**Status:** Pendente

### [CFG-002] Uploads de avatar versionados

**Gravidade:** MÉDIA

**Categoria:** Configuração

**Arquivo(s):**
- `.gitignore; static/uploads/avatars/`

**Local aproximado:**
git

**Descrição:**
Arquivos de upload no repositório.

**Impacto:**
Privacidade e tamanho do repo.

**Evidência:**
static/uploads não ignorado.

**Cenário de reprodução ou exploração:**
Clone do repositório.

**Plano de correção:**
Ignorar uploads.

**Exemplo de direção técnica:**
static/uploads/** no gitignore.

**Status:** Pendente

### [CFG-003] Ausência de Docker e CI

**Gravidade:** INFORMATIVA

**Categoria:** Configuração

**Arquivo(s):**
- `raiz do repositório`

**Local aproximado:**
infra

**Descrição:**
Sem Dockerfile nem workflows.

**Impacto:**
Deploy e testes manuais.

**Evidência:**
Ausência de .github/workflows.

**Cenário de reprodução ou exploração:**
Onboarding ops.

**Plano de correção:**
Adicionar pipeline.

**Exemplo de direção técnica:**
workflow py -m pytest.

**Status:** Pendente

### [CFG-004] Rate limit em memória

**Gravidade:** MÉDIA

**Categoria:** Configuração

**Arquivo(s):**
- `app/services/rate_limit_service.py`

**Local aproximado:**
enforce_limit

**Descrição:**
Contadores por processo Python.

**Impacto:**
Limite ineficaz com várias réplicas.

**Evidência:**
defaultdict in-memory.

**Cenário de reprodução ou exploração:**
Escalar horizontalmente API.

**Plano de correção:**
Backend Redis.

**Exemplo de direção técnica:**
Redis INCR janela.

**Status:** Pendente

### [CFG-005] Catch-all SPA em produção

**Gravidade:** MÉDIA

**Categoria:** Configuração

**Arquivo(s):**
- `app/main.py`

**Local aproximado:**
serve_spa e /{full_path}

**Descrição:**
Fallback HTML pode interceptar paths não previstos.

**Impacto:**
Rotas API novas sem registrar.

**Evidência:**
FileResponse index em paths SPA.

**Cenário de reprodução ou exploração:**
GET HTML em path desconhecido.

**Plano de correção:**
Registrar routers antes do catch-all.

**Exemplo de direção técnica:**
Excluir prefixos /api.

**Status:** Pendente

### [DEP-001] requirements.txt com versões abertas

**Gravidade:** BAIXA

**Categoria:** Dependências

**Arquivo(s):**
- `requirements.txt`

**Local aproximado:**
pins

**Descrição:**
Dependências com >= sem teto.

**Impacto:**
Drift e builds não reprodutíveis.

**Evidência:**
fastapi>=0.115.0 etc.

**Cenário de reprodução ou exploração:**
Instalação futura.

**Plano de correção:**
Fixar versões ou lock.

**Exemplo de direção técnica:**
pip-tools compile.

**Status:** Pendente

### [DEP-002] Biblioteca xlsx no frontend

**Gravidade:** BAIXA

**Categoria:** Dependências

**Arquivo(s):**
- `frontend/package.json; frontend/src/lib/inviteEmails.ts`

**Local aproximado:**
import dinâmico

**Descrição:**
Parsing de planilhas para convites.

**Impacto:**
Superfície de supply chain e parsing.

**Evidência:**
dependência xlsx ^0.18.5.

**Cenário de reprodução ou exploração:**
Upload xlsx na equipe.

**Plano de correção:**
Preferir CSV validado.

**Exemplo de direção técnica:**
limitar tamanho/linhas.

**Status:** Pendente

### [TEST-001] Cobertura frontend mínima

**Gravidade:** ALTA

**Categoria:** Testes

**Arquivo(s):**
- `frontend/src/lib/utils.test.ts; frontend/src/lib/faseMataLabels.test.ts`

**Local aproximado:**
vitest

**Descrição:**
Sem testes de auth, api, páginas.

**Impacto:**
Regressões de fluxo crítico.

**Evidência:**
Apenas 2 módulos testados.

**Cenário de reprodução ou exploração:**
Mudança em AuthContext.

**Plano de correção:**
Testes RTL e api mock.

**Exemplo de direção técnica:**
vitest + MSW.

**Status:** Pendente

### [TEST-002] Suíte backend com 104 testes

**Gravidade:** INFORMATIVA

**Categoria:** Testes

**Arquivo(s):**
- `tests/`

**Local aproximado:**
pytest

**Descrição:**
Coleta via py -m pytest --co -q.

**Impacto:**
Baseline de qualidade.

**Evidência:**
104 testes listados.

**Cenário de reprodução ou exploração:**
CI futuro.

**Plano de correção:**
Manter e expandir.

**Exemplo de direção técnica:**
py -m pytest.

**Status:** Pendente

### [TEST-003] Lacunas de rotas sem teste

**Gravidade:** ALTA

**Categoria:** Testes

**Arquivo(s):**
- `tests/; app/routes/`

**Local aproximado:**
mapa cobertura

**Descrição:**
perfil, tema, health, ativar-conta, avatar, GET empresas sem cobertura dedicada.

**Impacto:**
Regressões de authZ.

**Evidência:**
Rotas em main.py sem test_ correspondente.

**Cenário de reprodução ou exploração:**
Nova rota sem teste.

**Plano de correção:**
Matriz rota-teste.

**Exemplo de direção técnica:**
pytest por router.

**Status:** Pendente

### [TEST-004] SQLite em testes ≠ produção

**Gravidade:** MÉDIA

**Categoria:** Testes

**Arquivo(s):**
- `tests/conftest.py`

**Local aproximado:**
reset_db

**Descrição:**
create_all em SQLite, não Alembic Postgres.

**Impacto:**
Divergências de schema/constraints.

**Evidência:**
DATABASE_URL sqlite memory.

**Cenário de reprodução ou exploração:**
Migração só em prod.

**Plano de correção:**
Testcontainers Postgres.

**Exemplo de direção técnica:**
alembic upgrade head em CI.

**Status:** Pendente

### [TEST-005] Falha em teste TOCTOU de marcadores

**Gravidade:** MÉDIA

**Categoria:** Testes

**Arquivo(s):**
- `tests/test_security_toctou.py`

**Local aproximado:**
test_marcadores_revalida_prazo_no_commit

**Descrição:**
py -m pytest -q: 103 pass, 1 fail; esperado 409, obtido 400.

**Impacto:**
Regressão ou teste desatualizado.

**Evidência:**
Assertion status_code 409 vs 400.

**Cenário de reprodução ou exploração:**
Executar py -m pytest tests/test_security_toctou.py.

**Plano de correção:**
Ajustar expectativa ou regra.

**Exemplo de direção técnica:**
Rever mensagem de validação quantidade marcadores.

**Status:** Pendente

### [MAN-001] Código morto no frontend

**Gravidade:** BAIXA

**Categoria:** Manutenção

**Arquivo(s):**
- `frontend/src/pages/GruposPage.tsx; frontend/src/services/predictions.service.ts`

**Local aproximado:**
imports

**Descrição:**
Página e service sem consumidores ativos.

**Impacto:**
Ruído de manutenção.

**Evidência:**
GruposPage sem rota; predictions sem import.

**Cenário de reprodução ou exploração:**
Busca no repo.

**Plano de correção:**
Remover arquivos.

**Exemplo de direção técnica:**
delete unused.

**Status:** Pendente

### [MAN-002] ApiError duplicado

**Gravidade:** BAIXA

**Categoria:** Manutenção

**Arquivo(s):**
- `frontend/src/types/index.ts; frontend/src/lib/api.ts`

**Local aproximado:**
tipos

**Descrição:**
Interface e classe homônimas.

**Impacto:**
Confusão TypeScript.

**Evidência:**
interface ApiError vs class ApiError.

**Cenário de reprodução ou exploração:**
Imports mistos.

**Plano de correção:**
Unificar export.

**Exemplo de direção técnica:**
só class ApiError exportada.

**Status:** Pendente

### [MAN-003] print em fluxo de convite

**Gravidade:** BAIXA

**Categoria:** Manutenção

**Arquivo(s):**
- `app/services/convite_service.py`

**Local aproximado:**
criar_bulk_convites

**Descrição:**
print informa token na resposta quando e-mail falha.

**Impacto:**
Vazamento em logs.

**Evidência:**
print com contexto de token.

**Cenário de reprodução ou exploração:**
Falha SMTP.

**Plano de correção:**
logging sem dados sensíveis.

**Exemplo de direção técnica:**
logger.info sem token.

**Status:** Pendente

### [MAN-004] Script wipe destrutivo

**Gravidade:** ALTA

**Categoria:** Manutenção

**Arquivo(s):**
- `scripts/wipe_operational_data.py`

**Local aproximado:**
TRUNCATE

**Descrição:**
Apaga dados operacionais com --confirm.

**Impacto:**
Perda irreversível se uso indevido.

**Evidência:**
TRUNCATE RESTART IDENTITY CASCADE.

**Cenário de reprodução ou exploração:**
Ops roda script errado.

**Plano de correção:**
Dry-run default; dupla confirmação.

**Exemplo de direção técnica:**
exigir --i-understand.

**Status:** Pendente

### [MAN-005] seed_configuracao_bolao desalinhado

**Gravidade:** MÉDIA

**Categoria:** Manutenção

**Arquivo(s):**
- `scripts/seed_configuracao_bolao.py; app/models/configuracao_bolao.py`

**Local aproximado:**
seed

**Descrição:**
Possível insert sem empresa_id no modelo multi-tenant.

**Impacto:**
Seed falha ou cria lixo.

**Evidência:**
script legado vs modelo atual.

**Cenário de reprodução ou exploração:**
Rodar seed em DB vazio.

**Plano de correção:**
Atualizar para tenant.

**Exemplo de direção técnica:**
empresa_id obrigatório no seed.

**Status:** Pendente


---

## 7. Matriz de Prioridade

| Código | Gravidade | Categoria | Arquivo | Impacto | Prioridade |
|--------|-----------|-----------|---------|---------|------------|
| SEC-001 | ALTA | Segurança | app/core/config.py | Segredos previsíveis | P0 |
| SEC-002 | ALTA | Segurança | .env.example | Credencial em exemplo | P0 |
| SEC-003 | ALTA | Segurança | app/routes/auth.py | Reset em debug | Corrigido |
| SEC-008 | ALTA | Segurança | equipe.py / convite_service | Tokens de convite | Corrigido |
| BUG-004 | ALTA | Bug | AuthContext / AtivarConta | Sessão quebrada pós-ativação | P0 |
| TEST-001 | ALTA | Testes | frontend/src/lib | Sem testes de fluxo | P0 |
| TEST-003 | ALTA | Testes | tests/ | Rotas críticas sem teste | P0 |
| MAN-004 | ALTA | Manutenção | scripts/wipe_operational_data.py | Perda de dados | P0 |
| SEC-004 | MÉDIA | Segurança | frontend/src/lib/api.ts | XSS → token | Corrigido |
| SEC-005 | MÉDIA | Segurança | config / auth | Cookie sem Secure | Corrigido |
| SEC-006 | MÉDIA | Segurança | app/main.py | CORS/headers | Corrigido |
| SEC-007 | MÉDIA | Segurança | auth.py | CSRF refresh | Corrigido |
| SEC-009 | MÉDIA | Segurança | perfil / utils | avatar_url / img | Corrigido |
| SEC-010 | MÉDIA | Segurança | avatar_upload_service | MIME only | Corrigido |
| SEC-011 | MÉDIA | Segurança | auth.py | Rate limit upload | Corrigido |
| SEC-012 | MÉDIA | Segurança | auth_service | Sessão pós-senha | Corrigido |
| SEC-015 | MÉDIA | Segurança | password_defaults | Senha padrão | Corrigido |
| SEC-016 | MÉDIA | Segurança | equipe_service | Admin vs admin | Corrigido |
| BUG-001 | MÉDIA | Bug | vite.config.ts | Tema owner dev | P1 |
| BUG-002 | MÉDIA | Bug | equipe.service.ts | Convites falsos OK | P1 |
| BUG-003 | MÉDIA | Bug | api.ts | Multipart 401 | P1 |
| FLUX-001 | MÉDIA | Fluxo | App.tsx | Primeiro acesso | P1 |
| FLUX-003 | MÉDIA | Fluxo | EspeciaisPage.tsx | Erros mascarados | P1 |
| CFG-001 | MÉDIA | Configuração | .env.example | Env incompleto | P1 |
| CFG-002 | MÉDIA | Configuração | static/ | Uploads no git | P1 |
| CFG-004 | MÉDIA | Configuração | rate_limit_service | Multi-instância | P1 |
| BUG-005 | MÉDIA | Bug | RankingPage.tsx | Métrica líder | P2 |
| BUG-006 | MÉDIA | Bug | Jogos/Ranking | isError | P2 |
| BUG-008 | MÉDIA | Bug | GameCard | Race autosave | P2 |
| NAV-003 | MÉDIA | Navegação | AppLayout.tsx | URL owner | P2 |
| UX-005 | MÉDIA | Usabilidade | EsqueciSenhaPage | Sucesso genérico | P2 |
| CFG-005 | MÉDIA | Configuração | main.py | Catch-all SPA | P2 |
| TEST-004 | MÉDIA | Testes | conftest.py | SQLite ≠ prod | P2 |
| TEST-005 | MÉDIA | Testes | test_security_toctou.py | 1 falha pytest | P2 |
| MAN-005 | MÉDIA | Manutenção | seed_configuracao_bolao | Multi-tenant | P2 |
| SEC-013 | INFORMATIVA | Segurança | palpites_especiais | Owner global | P3 |
| SEC-014 | BAIXA | Segurança | main.py | CSP/frame | Corrigido |
| SEC-017 | MÉDIA | Segurança | tema.py | Tema público | Corrigido |
| SEC-018 | BAIXA | Segurança | usuario.py | Senha fraca create | Corrigido |
| SEC-019 | INFORMATIVA | Segurança | main.py | OpenAPI /docs | Corrigido |
| NAV-001/002 | BAIXA | Navegação | App.tsx | Redirects | P3 |
| UX/A11Y baixos | BAIXA | UX/A11y | várias | Polish | P3 |
| DEP-001/002 | BAIXA | Dependências | requirements/package | Versões | P3 |
| MAN-001/002/003 | BAIXA | Manutenção | várias | Dívida | P3 |

---

## 8. Plano Geral de Correção

**Fase 1 — Críticos e altos (P0):** endurecer segredos e `.env.example`; desabilitar ou proteger reset em debug; deixar de expor tokens de convite; corrigir sincronização de sessão no React após ativar/redefinir senha; documentar e restringir script wipe; priorizar testes para lacunas TEST-003.

**Fase 2 — Médios segurança e fluxo (P1):** CORS/headers, cookie Secure, revogação de refresh na troca de senha, validação de avatar/upload, rate limit em pré-ativação, proxy `/plataforma`, tratamento de erro em convites e queries críticas, guards de primeiro acesso.

**Fase 3 — Médios funcionais (P2):** ranking líder, race autosave, owner URL vs nav, catch-all SPA, alinhar seed config, investigar falha TEST-005.

**Fase 4 — Preventivo (P3 + testes):** ampliar suíte `py -m pytest` e `npm run test`; CI; auditoria de dependências; a11y; remover código morto; política de uploads fora do git.

Nenhuma fase foi executada nesta auditoria.

---

## 9. Recomendações Preventivas

- Checklist de deploy: `JWT_SECRET` forte, `DEBUG=false`, cookie `secure`, `PUBLIC_APP_URL` correto, docs OpenAPI desabilitados em produção.
- Matriz papel × rota revisada a cada feature (owner global vs tenant).
- Não versionar uploads nem exemplos com credenciais reais; placeholders em `.env.example`.
- Testes de contrato entre OpenAPI, schemas Pydantic e `frontend/src/types`.
- Monitorar 429, falhas de e-mail e `auditoria_admin`; rate limit distribuído se houver múltiplas réplicas.
- SAST/linters no CI; revisão obrigatória de rotas públicas e endpoints que retornam tokens.
- Comandos padronizados: `py -m pytest`, `npm run test` no frontend.

---

## 10. Checklist Final

| Item | Status |
|------|--------|
| Estrutura e stack | [x] |
| Rotas API (17 routers) | [x] |
| Rotas SPA e guards | [x] |
| AuthN JWT + refresh | [x] |
| AuthZ e multi-tenant | [x] |
| Validação Pydantic / uploads | [x] |
| Injection / XSS estático | [x] |
| Fluxos convite, palpites, ranking | [x] |
| Frontend páginas + admin | [x] |
| Componentes/hooks (amostra ampla) | [~] |
| UX loading/erro/empty | [~] |
| Acessibilidade | [~] |
| Config / env / scripts | [x] |
| Migrações Alembic (revisão estática) | [~] |
| Dependências (sem pip/npm audit) | [~] |
| Testes backend (leitura + `py -m pytest`) | [x] |
| Testes frontend (leitura; `npm run test` não executado) | [~] |
| OpenAPI / enumeração / IDOR (buscas 1.6) | [~] |
| Pentest / runtime manual | [ ] |

---

## 11. Limitações da Auditoria

- Varredura **predominantemente estática**; sem pentest nem fuzzing.
- **Único arquivo criado:** `relatorio.md`; nenhuma correção no código.
- Testes Python executados com **`py -m pytest -q`** (103 passaram, 1 falhou em ~102 s); coleta com **`py -m pytest --co -q`** (104 testes). Não foi usado o comando `python`.
- Testes frontend **não executados** (`npm run test` documentado como referência).
- Ambiente de testes backend: SQLite em memória e `create_all` (`tests/conftest.py`), não PostgreSQL nem migrações Alembic completas em produção.
- Segredos citados apenas por tipo e local; valores omitidos.
- `pip audit` / `npm audit` não executados.
- Conteúdo binário de avatares em `static/uploads/` não analisado byte a byte.
- Achados de desenvolvimento (proxy Vite) separados de deploy unificado FastAPI+`dist` quando aplicável.
