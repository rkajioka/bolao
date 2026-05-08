# Análise Completa do Repositório — Bolão da Copa

**Escopo:** análise e documentação apenas, com base no código e artefatos do repositório no momento da revisão (FastAPI + React/Vite + PostgreSQL + Alembic).  
**Metodologia:** leitura de `app/`, `frontend/`, `alembic/`, `tests/`, `scripts/` e arquivos de configuração. Onde algo não foi inspecionado linha a linha, está indicado como inferência ou **NÃO IDENTIFICADO**.

---

## 1. Resumo executivo

| Pergunta | Resposta objetiva |
| -------- | ----------------- |
| A aplicação está madura ou ainda está em fase de POC? | **MVP estruturado**, além de um POC: há modelagem de domínio, serviços, migrações, testes automatizados (permissões, pontuação, ranking, rate limit, e-mail mock, etc.) e painel admin. |
| Ela parece pronta para produção? | **Não de forma integral.** Há bases sólidas (auth no backend, recálculo de pontos, auditoria admin parcial), mas faltam endurecimento operacional (secrets, CORS explícito se API separada, isolamento multi-tenant no ranking, hardening de deploy) e validação de produto (regras na UI vs. config real). |
| Principais pontos fortes? | Separação routers/services/models; JWT + refresh em cookie **HttpOnly**; `require_admin` em rotas sensíveis; unicidade `palpite` por `(usuario_id, jogo_id)`; recálculo de pontos acoplado a persistência de resultado; testes de permissão e sanitização de parâmetros; UI coesa (tema, navegação, lazy routes). |
| Principais riscos? | **Ranking e listagens globais** sem filtro por `empresa_id` coexistindo com modelo multi-empresa; **rate limit em memória** (não compartilhado entre instâncias); valores padrão fracos de **`JWT_SECRET`** em `Settings`; tela **Regras** com pontuação **estática** possivelmente dessincronizada da tabela `configuracoes_bolao`; endpoint de **resultado especial** legível só por admin (usuário não vê “gabarito” oficial na API). |
| Cinco maiores pendências? | (1) Definir e implementar **isolamento de dados por empresa** onde o produto exige (ranking, jogos, palpites). (2) **Produção:** secrets, HTTPS, cookie `secure`, observabilidade. (3) Alinhar **Regras** à configuração real ou torná-las dinâmicas. (4) **Expor com segurança** resultado oficial de especiais (leitura autenticada, sem edição). (5) **Deploy:** ausência de Docker/README raiz documentado (**NÃO IDENTIFICADO** no repositório para Docker). |
| O projeto parece escalável? | **Escala modesta (uma instância, empresa única ou poucos tenants)** sem mudanças. Para muitos usuários/instâncias: revisar agregação de ranking, rate limit distribuído e pool de DB. |
| O código parece fácil de manter? | **Sim, em média:** pastas previsíveis (`routes`, `services`, `models`), TypeScript no front, convenções consistentes. Algumas telas e serviços concentram lógica (ex.: `JogosPage`, `jogo_service`). |
| O banco está bem modelado? | **Razoável a bom:** FKs, unicidades importantes, timestamps; campos de mata-mata (prorrogação, pênaltis) no modelo `Jogo`. Evolução com Alembic documentada. |
| Autenticação e permissões parecem seguras? | **Autenticação:** boa prática com refresh em cookie HttpOnly e access token no cliente. **Autorização:** admin verificado no **backend** (`require_admin`), não só no front — testado em `tests/test_permissions.py`. Riscos residuais: bypass por **bugs de tenant** (dados de outra empresa no ranking) e configuração fraca de JWT em prod. |
| O admin parece robusto o suficiente? | **Parcial.** Há CRUD de jogos/usuários, especiais, marcadores BR, recálculos e auditoria (`auditoria_admin`). Não há, no escopo inspecionado, **UI completa** para cada nuance operacional (ex.: histórico de alterações rico, workflow de aprovação). |

### Tabela de avaliação geral

| Área | Avaliação | Risco | Observação |
| ---- | --------- | ----- | ---------- |
| Frontend | Boa | Média | Organizado; `AdminRoute` só oculta UI — mitigado porque API exige admin. Regras estáticas podem enganar o usuário. |
| Backend | Boa | Média | FastAPI, camadas claras; boa cobertura de regras em serviços. |
| Banco de dados | Boa | Média | Modelo coerente; risco de regra de negócio multi-empresa vs. consultas globais. |
| Segurança | Média | Média a Alta | JWT padrão “change-me”; rate limit process-local; sem CORS explícito (aceitável se monólito SPA+API mesmo host). |
| UX/UI | Boa | Baixa a Média | Fluxo palpites/ranking/especiais claro; muitos jogos podem gerar scroll/filtros. |
| Escalabilidade | Média | Média | Ranking calculado via agregação SQL — OK até certo volume; horizontal scaling exige ajustes. |
| Pronto para produção | Não integralmente | Média | Falta endurecimento de config, tenant, deploy e alinhamento conteúdo regras vs. backend. |

---

## 2. Visão geral da aplicação

### O que é e qual problema resolve

Sistema web de **bolão corporativo** para a Copa do Mundo: usuários palpitam placares (e classificados no mata-mata), **marcadores do Brasil** em jogos do Brasil, e **palpites especiais** (pódio + país do artilheiro). Administradores cadastram jogos, resultados oficiais e configurações; o backend **recalcula pontuações** persistidas em `palpites_jogos` e `palpites_especiais`.

### Usuários e perfis (encontrado no código)

- **`tipo_usuario`:** `"admin"` ou `"usuario"` (`app/models/usuario.py`, schema `UsuarioBase`).
- **Multi-empresa:** `Usuario.empresa_id` opcional; fluxos de **equipe/convites** exigem admin vinculado à empresa (`app/routes/equipe.py`).

### Módulos / rotas principais (frontend)

Definidas em `frontend/src/App.tsx` + `frontend/src/layouts/AppLayout.tsx`:

- **Públicas:** login, primeiro acesso, ativar conta, esqueci/redefinir senha.
- **Autenticadas:** Palpites (`/jogos`), Especiais (`/especiais`), Regras (`/regras`), Ranking (`/ranking`), Perfil (`/perfil`).
- **Admin (UI + API):** Admin (`/admin`), Equipe (`/equipe`).  
- **`/grupos`** redireciona para `/jogos` — a tabela por grupo é **aba dentro de Palpites**, não rota separada.

### Lógica geral: palpites → pontos → ranking

1. **Palpites de jogo:** `PalpiteJogo` por usuário/jogo; bloqueio por **jogo finalizado** e por **prazo** (1h antes do primeiro jogo da rodada de grupos ou regra equivalente no mata-mata) — `app/services/palpite_jogo_service.py`, `jogo_service.momento_fim_edicao_palpite` (referenciado no serviço).
2. **Pontuação:** `app/services/pontuacao_service.py` — placar exato vs. resultado; mata-mata com **classificado**; bônus **marcadores Brasil**; fases com possível override via `pontuacao_fase` (`_config_para_jogo`).
3. **Recálculo:** ao salvar resultado/finalizar jogo (`jogo_service`); ao salvar resultado especial (`resultado_especial_service`); endpoints admin de recálculo em `palpites_especiais`, `marcadores_brasil`.
4. **Ranking:** agregação em tempo real em `ranking_service.listar_ranking` — **sem tabela materializada**; ordenação por total + nome.

### Papel do admin

Cadastro/edição de **jogos** e **resultados**, **usuários**, **resultado especial** singleton, **candidatos marcador BR**, operações de **marcadores** e **recálculo**; **auditoria** de ações em várias rotas (`auditoria_admin_service`).

---

## 3. Estrutura do repositório

### Pastas principais

| Caminho | Conteúdo |
| ------- | -------- |
| `app/` | Backend FastAPI: `main.py`, `routes/`, `services/`, `models/`, `schemas/`, `auth/`, `core/config.py`, `database.py` |
| `frontend/` | React + TypeScript + Vite: `src/pages`, `components`, `features/admin`, `services`, `lib/api.ts` |
| `alembic/versions/` | Migrações (11 arquivos `.py` identificados) |
| `tests/` | Pytest: permissões, pontuação, ranking, SQL injection sanity, rate limit, e-mail, etc. |
| `scripts/` | Seeds/auxiliares (ex.: `seed_admin.py`, `seed_paises_grupos.py`) |
| `static/` | Arquivos servidos em `/static` (bandeiras, uploads de avatar) |

### Arquivos de ambiente e dependências

- **Backend:** `requirements.txt` (não detalhado nesta análise linha a linha), `alembic.ini`, `.env` (local, fora do escopo de conteúdo), **`.env.example`** com `DATABASE_URL`, `JWT_*`, `PUBLIC_APP_URL`.
- **Frontend:** `package.json`, `vite.config.ts` (proxy para API em dev).

### Como rodar localmente (inferido)

- **Backend:** `uvicorn app.main:app` (conforme uso no projeto); exige PostgreSQL e migrações Alembic.
- **Frontend dev:** `npm run dev` no `frontend/` com proxy para `localhost:8000` (`vite.config.ts`).

### Docker / README raiz

- **Dockerfile no repositório:** **NÃO IDENTIFICADO** (busca sem resultado).
- **README na raiz:** **NÃO IDENTIFICADO** na leitura (arquivo não encontrado no caminho esperado).
- **Documentação extra:** existem `DOCUMENTACAO_COMPLETA_BOLAO_COPA.md`, `proximos_passos.md`, `inicio.md` (não substituem esta análise).

### Organização e camadas

- **Boa separação** rota → serviço → modelo.
- **ORM:** SQLAlchemy 2.0 style (`Mapped`, `mapped_column`); **sem SQL bruto** identificado nas rotas principais — uso de `select()` parametrizado.
- **Duplicação:** possível entre **valores de regras na UI** (`RegrasPage.tsx`) e **`configuracoes_bolao`** no banco (**risco de produto**).

### Avaliação qualitativa (checklist do pedido)

| Questão | Julgamento |
| ------- | ---------- |
| Projeto organizado? | Sim |
| Arquivos bem separados? | Sim |
| Duplicação de lógica? | Alguma (regras na UI vs. config dinâmica) |
| Componentes grandes demais? | `JogosPage`, `RankingPage`, possivelmente `GameCard` — médio porte |
| Regra de negócio na UI? | Mínima; palpites dependem da API |
| Acesso ao banco misturado com regra? | Pouco nas rotas; concentrado em services |
| Nomes claros? | Sim, em geral |
| Padrões consistentes? | Sim no backend; front com React Query + serviços |

---

## 4. Arquitetura frontend

### Stack

- **React 19 + TypeScript + Vite** (`frontend/package.json` inferido pela estrutura).
- **Roteamento:** `react-router-dom` (`App.tsx`).
- **Dados:** `@tanstack/react-query` (`JogosPage`, `RankingPage`, `EspeciaisPage`, etc.).
- **HTTP:** `fetch` encapsulado em `frontend/src/lib/api.ts` (JSON + `apiPostMultipart`); refresh em `/auth/refresh` com cookie.
- **Estilo:** Tailwind v4 (`@tailwindcss/vite`), variáveis CSS de tema (`useTheme`).

### Estado e auth

- **Auth global:** `AuthContext` — token em `localStorage`, `isAdmin` derivado de `user.tipo_usuario`.
- **Proteção de rotas:** `ProtectedRoute` (autenticado), `AdminRoute` (redireciona não-admin para `/jogos`).

### Componentes reutilizáveis (exemplos)

`GameCard`, `CountryFlag`, `CountrySelect`, `UserAvatar`, `SegmentedControl`, `SectionHeader`, `GroupStandingsTable`, skeletons.

### Tratamento de loading/erro

- Loading: spinners, skeletons, `isLoading` do React Query.
- Erro: `ApiError` em `api.ts`; toasts em várias páginas.

### Palpites (`JogosPage.tsx`)

- Abas **Cronológico** / **Por grupo**.
- Filtro **Em aberto** / **Fechados**.
- Segmentação por rodada/fase via utilitários em `lib/utils.ts` (`palpiteSegmentOptionsFromJogos`, etc.).
- Integração **marcadores Brasil**: query `/marcadores-brasil/candidatos`, palpites `/palpites-jogos/me`, jogos `/jogos/cronologico`, grupos `/grupos`, tabela `/grupos/{id}/tabela`.
- **Classificação:** `GroupStandingsTable` com dados calculados no backend.

### Especiais (`EspeciaisPage.tsx`)

- Campos: **campeão, vice, terceiro, país do artilheiro** (não há “melhor jogador/goleiro” no formulário).
- Bloqueio: flag `bloqueado` no palpite + mensagem na UI.

### Ranking (`RankingPage.tsx`)

- Ordenação por total / jogos / especiais+bônus BR; pódio visual; insights de período (`/ranking/insights`).
- Bandeiras do pódio nos especiais por linha (implementação recente).

### Regras (`RegrasPage.tsx`)

- Conteúdo **estático** (arrays `SCORING`, `ESPECIAIS`) — **não** lê `/configuracao-bolao` na UI inspecionada.

### Equipe (`EquipePage.tsx`)

- **Somente admin** na navegação; convites, listagem de membros — alinhado a multi-empresa.

### Admin (`AdminPage.tsx`)

- Lazy load: `AdminGames`, `AdminUsers`, `AdminSpecials`.

### Avaliação (itens do pedido)

| Critério | Avaliação |
| -------- | --------- |
| Componentização | Adequada |
| Componentes grandes | `JogosPage` carrega várias responsabilidades |
| Duplicação cronológico/grupo | Mitigada por componente `GameCard` e mesmas queries base |
| Estado palpites | Centralizado via React Query + servidor como fonte da verdade |
| UI para muitos jogos | Risco de **scroll longo**; filtros ajudam |
| Re-render | **NÃO MEDIDO** — possível otimização com memo em listas grandes |
| Navegação | Simples; bottom nav em `AppLayout` (arquivo parcialmente lido) |

---

## 5. Arquitetura backend

### Stack

- **FastAPI**, **SQLAlchemy**, **Pydantic v2**, **Alembic**.
- **Entrada:** routers em `app/routes/*.py`; dependências em `app/auth/dependencies.py`.

### Organização

- **Services:** regra de negócio (`palpite_jogo_service`, `jogo_service`, `pontuacao_service`, …).
- **Models + schemas:** espelhamento para IO HTTP.

### Autenticação / autorização

- **JWT** Bearer para rotas autenticadas; **refresh** rotativo com cookie (`auth.py`, `auth_service`).
- **`require_admin`**, **`require_primeiro_login_concluido`**, **`get_empresa_id`** conforme rota.

### SQL / injeção

- Padrão ORM com parâmetros; teste `tests/test_sql_injection.py` valida que payload malicioso em `/grupos/{grupo}/tabela` não gera 500.

### Validações

- Pydantic nos bodies; `ValueError` convertido em HTTP 400 nos serviços de palpite.

### Logs

- Serviços de e-mail e convites com `print`/logger (padrão observado em trabalhos recentes); **sem framework de logging estruturado** centralizado **NÃO IDENTIFICADO** além do padrão FastAPI/uvicorn.

### CORS

- **Não há `CORSMiddleware` em `app/main.py`.** Em produção monolítica (API servindo `frontend/dist`), mesmo origin reduz necessidade. Se API e front ficarem em origens diferentes, **PENDENTE** configurar CORS restritivo.

---

## 6. Banco de dados e modelagem

### Tabelas identificadas (via `app/models/__init__.py` e migrações)

| Tabela (model) | Finalidade resumida |
| -------------- | ------------------- |
| `usuarios` | Usuários, auth, perfil, `tipo_usuario`, `empresa_id` |
| `empresas` | Tenant |
| `convites` | Convites de equipe |
| `jogos` | Partidas, placar, fase, rodada, flags prorrogação/pênaltis, classificado |
| `paises` | Seleções, bandeiras |
| `palpites_jogos` | Palpite por jogo; pontuações agregadas; **unique (usuario_id, jogo_id)** |
| `palpites_especiais` | Um registro por usuário (unique em `usuario_id`) |
| `resultados_especiais` | Gabarito oficial do torneio (singleton operacional) |
| `configuracoes_bolao` | Pontos e datas de bloqueio |
| `configuracao_email` | Config de envio (ex.: Resend) |
| `pontuacao_fase` | Overrides de pontuação por fase |
| `candidatos_marcador_brasil` | Lista admin de jogadores para bônus BR |
| `marcadores_brasil_palpite` / `resultado` | Palpites e conferência por jogo |
| `auditoria_admin` / `audit_log` | Trilhas de auditoria (duas entidades — ver migrações para uso exato) |
| `password_reset` | Tokens de reset |
| `refresh_tokens` | Sessões refresh |

### Constraints e integridade (destaques verificados)

- **Um palpite por usuário/jogo:** `UniqueConstraint` em `PalpiteJogo` — **sim**.
- **Uma aposta especial por usuário:** `UniqueConstraint` em `PalpiteEspecial` — **sim**.
- **Jogo ↔ país:** FKs `pais_casa_id`, `pais_fora_id`, `classificado_id`.
- **Auditoria / timestamps:** presentes nos modelos principais.
- **Campo “quem alterou resultado”:** **NÃO IDENTIFICADO** como coluna dedicada em `Jogo`; auditoria pode registrar eventos admin (depende de `auditoria_admin_service`).

### Riscos de modelagem

- **Ranking global** com `Usuario.ativo` apenas — sem `empresa_id` no `ranking_service` (**inconsistência multi-tenant** se o produto for “bolão por empresa”).
- **Órfãos:** exclusões em cascata **NÃO MAPEADAS** em todos os relacionamentos nesta revisão rápida — **PENDENTE** revisar `ondelete` onde necessário.

---

## 7. Autenticação, sessão e permissões

### Login

- `POST /auth/login` — rate limit por IP+email em falhas; cookie de refresh setado; access token no JSON.

### Frontend

- Access token: `localStorage` (`bolao_access_token`).
- Refresh: cookie HttpOnly, path `/auth` — **não acessível via JS** (mitigação XSS para refresh).

### Backend

- `get_token_payload` → `get_current_user_id` → `get_current_user` → `get_current_active_user`.
- **Admin:** `require_admin` checa `user.tipo_usuario == "admin"` **no servidor**.

### Cenários de ataque (síntese)

| Cenário | Situação |
| ------- | -------- |
| Usuário acessa `/admin` no front | Redireciona para `/jogos` se não admin — **UI apenas**; **API continua sendo gate real**. |
| Chamada direta a `POST /jogos` | **403** para usuário comum (teste automatizado). |
| Manipular `user_id` no body | Palpites usam `user.id` do token, não ID do payload (**bom** para rotas inspecionadas). |
| Token expirado | 401; `api.ts` tenta refresh; falha → logout event. |
| Role admin forjada no JWT | Assinatura inválida falha; se secret vazado, **crítico** — exige rotação de secret em incidente. |

---

## 8. Fluxo do usuário comum

| Etapa | Tela | Endpoints (principais) | Observações |
| ----- | ---- | ---------------------- | ----------- |
| 1. Login | `LoginPage` | `POST /auth/login`, depois `GET /auth/me` | Refresh em cookie |
| 2. Primeiro acesso | `PrimeiroAcessoPage` | `POST /auth/primeiro-acesso`, upload avatar `/perfil/avatar` | Bloqueio de rotas “normais” até concluir (`require_primeiro_login_concluido`) |
| 3. Palpites | `JogosPage` | `GET /jogos/cronologico`, `GET /palpites-jogos/me`, `POST/PUT /palpites-jogos` | Bloqueio server-side por prazo/finalização |
| 4. Marcadores BR | `GameCard` / Brasil | `GET /marcadores-brasil/candidatos`, writes via API de marcadores | Depende de jogos do Brasil |
| 5. Grupos | Aba em `JogosPage` | `GET /grupos`, `GET /grupos/{L}/tabela` | Tabela calculada no backend |
| 6. Especiais | `EspeciaisPage` | `GET /palpites-especiais/me`, `POST/PUT /palpites-especiais` | Bloqueio por config + `bloqueado` |
| 7. Ranking | `RankingPage` | `GET /ranking`, `GET /ranking/insights` | Ver seção multi-empresa |
| 8. Regras | `RegrasPage` | Nenhuma (estático) | **Dessincronização possível** com backend |
| 9. Perfil | `PerfilPage` | `GET/PATCH /perfil`, senha `POST /auth/change-password` | — |

**Possíveis erros frágeis:** usuário acreditar que regras da tela são as mesmas dos pontos reais; não ver **resultado oficial** de especiais na UI (sem endpoint público inspecionado além do admin).

---

## 9. Fluxo do admin

| Etapa | Onde | Endpoints / ações |
| ----- | ---- | ----------------- |
| Login | Mesmo fluxo | Token com `tipo_usuario=admin` |
| Painel | `AdminPage` | Abas Jogos / Usuários / Especiais |
| Jogos | `AdminGames` + `jogo_service` | `POST/PUT` `/jogos`, resultado, finalizar — com **auditoria** em várias operações |
| Usuários | `AdminUsers` | `/usuarios` CRUD, reset senha |
| Especiais oficiais | `AdminSpecials` | `/resultados-especiais` (GET/POST/PUT **admin**), recálculo `/palpites-especiais/recalcular` |
| Equipe | `EquipePage` | `/equipe`, convites `POST /equipe/convites` |
| Marcadores | Rotas em `marcadores_brasil.py` | Inclusão candidatos, resultado, recálculo |

**PENDENTE / parcial** em relação ao roteiro ideal do usuário: “tratar prorrogação/pênaltis” está **no modelo**, mas a **pontuação efetiva** usa principalmente placares oficiais — regra exata de agregação pós-prorrogação **deve ser validada** em `pontuacao_service` e uso admin (leitura adicional recomendada, não concluída linha a linha neste documento).

---

## 10. Funcionalidades existentes

### Usuário comum

| Nome | Descrição | Status | Arquivos |
| ---- | --------- | ------ | -------- |
| Login / logout / refresh | Sessão com JWT + cookie | Completa | `auth.py`, `api.ts`, `AuthContext.tsx` |
| Primeiro acesso | Nome, função, senha, avatar | Completa | `PrimeiroAcessoPage`, `perfil.py` |
| Ativação por convite | Token na URL, upload pré-avatar | Completa | `ativar-conta`, `auth.py` |
| Palpites jogos | CRUD com bloqueio | Completa | `palpites_jogos.py`, `JogosPage` |
| Marcadores BR | Bônus por jogo | Parcial a Completa | `marcadores_brasil/*`, `BrazilScorers` |
| Especiais | Pódio + país artilheiro | Completa | `EspeciaisPage`, `palpite_especial` |
| Ranking + insights | Lista e destaques de período | Completa | `ranking.py`, `RankingPage` |
| Regras | Texto e tabela de pontos | **Frágil** (estático) | `RegrasPage.tsx` |
| Perfil / senha | Edição e troca de senha | Completa | `PerfilPage`, `perfil.py`, `auth` |

### Admin

| Nome | Descrição | Status | Arquivos |
| ---- | --------- | ------ | -------- |
| CRUD jogos + resultado | Inclui flags mata-mata | Completa | `jogos.py`, `AdminGames` |
| Usuários | Lista, criar, atualizar, status | Completa | `usuarios.py`, `AdminUsers` |
| Resultado especial | Singleton | Completa | `resultados_especiais.py` |
| Recálculos | Especiais, marcadores | Completa | rotas `PATCH` dedicadas |
| Equipe / convites | Multi-empresa | Completa | `equipe.py`, `EquipePage` |
| Auditoria admin | Registro de ações | Parcial | `auditoria_admin_service` |

### Sistema interno

| Nome | Descrição | Status |
| ---- | --------- | ------ |
| Pontuação automática | Após resultado | Completa |
| Config bolão | Pontos por tipo | Completa (`configuracao_bolao`) |
| E-mail (convite/reset) | Resend + fallback token | Parcial operacional (depende domínio Resend) |

### Segurança

| Nome | Status |
| ---- | ------ |
| Rate limit login/refresh | Completa (process-local) |
| Testes permissão admin | Completa |
| Hash senha | **NÃO DETALHADO** aqui — ver `app/auth/password.py` |

### UX/UI

| Nome | Status |
| ---- | ------ |
| Tema claro/escuro | Completa (`useTheme`) |
| Toasts / estados vazios | Presente |

---

## 11. Funcionalidades pendentes ou incompletas

| Funcionalidade | Área | Status | Impacto | Prioridade | Observação |
| -------------- | ---- | ------ | ------- | ---------- | ---------- |
| Isolamento ranking por empresa | Backend | PENDENTE | Alto | P1 | `ranking_service` lista todos `Usuario.ativo` |
| Regras dinâmicas alinhadas à config | Front | PENDENTE | Médio | P2 | `RegrasPage` hardcoded |
| Leitura resultado especial para usuário | API/Front | PENDENTE | Médio | P2 | GET `/resultados-especiais` exige admin |
| Deploy containerizado / CI | Ops | NÃO IDENTIFICADO | Médio | P2 | Sem Dockerfile encontrado |
| Rate limit distribuído | Backend | PENDENTE | Médio | P3 | Memória local |
| CORS explícito multi-origin | Backend | PENDENTE | Baixo a Médio | P3 | Se arquitetura separar front/API |
| Melhor jogador / goleiro nos especiais | Produto | **NÃO EXISTE** | — | — | Modelo tem país do artilheiro, não prêmios FIFA extras |
| README raiz “como rodar” | Docs | PENDENTE | Baixo | P4 | Facilita onboarding |

---

## 12. Regras de negócio e pontuação

### Palpites de jogos (fonte: `pontuacao_service.py`, `palpite_jogo_service.py`)

- **Placar exato:** pontos `pontos_placar_exato` (config).
- **Só resultado (vitória/empate):** `pontos_resultado_correto` se não for placar exato.
- **Mata-mata:** mesmo núcleo + **`pontos_classificado_mata_mata`** se `palpite_classificado_id` bate com oficial e classificado definido.
- **Override por fase:** `pontuacao_fase` quando existe `fase_key` para o jogo.
- **Palpite vazio / incompleto:** tratado como 0 em cálculo de placar (`None` → 0 pts).
- **Após prazo / jogo finalizado:** alteração bloqueada (`ValueError` → 400).

### Apostas especiais

- Campos: **campeão, vice, terceiro, país do artilheiro** (`PalpiteEspecial`).
- Pontuação por acerto usa `configuracoes_bolao` + `ResultadoEspecial.finalizado`.
- **Melhor jogador / goleiro:** **NÃO IDENTIFICADO** no modelo — **não existem** no escopo atual.

### Bônus marcadores Brasil

- Matching por nome normalizado + quantidade; pontos `pontos_marcador_brasil` e `pontos_marcador_brasil_com_quantidade`.
- Recálculo integrado a fluxo de resultado de jogo / stubs admin.

### Mata-mata (empate, prorrogação, pênaltis)

- Modelo `Jogo` armazena `teve_prorrogacao`, `foi_para_penaltis`, `penaltis_casa/fora`.
- **PENDENTE DE DEFINIÇÃO** (sem leitura completa de todo `pontuacao_service`): se o placar persistido já reflete resultado final regulamentar ou se há regra adicional explícita para somar tempos extras na pontuação.

---

## 13. UX/UI e experiência de uso

### Pontos fortes

- Navegação clara: Palpites, Especiais, Regras, Ranking.
- Feedback de bloqueio em especiais e estados de jogo.
- Visual consistente (vidro, accent verde, ícones).

### Pontos fracos / recomendações práticas

1. **Sincronizar Regras com backend** ou exibir “valores configurados pelo admin” via API — evita sensação de injustiça.
2. Em **Palpites**, com Copa 2026 e muitos jogos: considerar **âncoras por rodada** ou resumo “faltam X jogos para palpitar”.
3. Deixar explícito quando o placar exibido é **oficial** vs. palpite (o `GameCard` trata vários estados — revisar copy).
4. **Ranking:** ordenação alternativa já existe; comunicar no rodapé o que “E” e “BR” significam (há legenda em insights).

---

## 14. Responsividade

- Layout `max-w-2xl` centralizado — **bom para mobile**.
- Navegação inferior/topbar (ver `AppLayout` completo): **NÃO AVALIADO pixel a pixel**.
- Tabelas de classificação: podem exigir scroll horizontal em telas estreitas — **PENDENTE** teste manual.
- Dropdowns com bandeiras (`CountrySelect`): verificar teclado/acessibilidade — **PENDENTE**.

---

## 15. Segurança

### SQL Injection

- Uso majoritário de ORM parametrizado; teste de grupo malicioso não gera 500.  
- **Severidade:** **Baixa** (com ressalva de revisar qualquer query dinâmica futura).

### Authorization bypass

- Admin verificado no backend.  
- **Risco tenant:** usuário ver ranking/palpites de outra empresa se dados globais — **Média a Alta** dependendo do modelo de negócio.

### Validação de entrada

- Pydantic limita tipos; placares **negativos** — **PENDENTE** confirmar validators em `PalpiteJogoCreate` (não expandido aqui).

### Dados sensíveis

- `.env.example` sugere padrões; **não copiar secrets** neste doc.  
- **Risco:** `jwt_secret` default fraco em `Settings` — **Alta** se deploy sem override.

### XSS

- React escapa texto por padrão; sem `dangerouslySetInnerHTML` identificado nas páginas lidas.

### CORS

- Ausente no `main.py`; **Baixa** severidade em monólito; **Média** se API exposta separadamente.

### Tabela de riscos (amostra)

| ID | Área | Risco | Severidade | Arquivo/Rota | Recomendação |
| -- | ---- | ----- | ---------- | ------------ | ------------ |
| S1 | Config | JWT secret padrão | **Alta** | `app/core/config.py` | Obrigar secret forte em prod; validação startup |
| S2 | Multi-tenant | Ranking global | **Média** | `ranking_service.py` | Filtrar por `empresa_id` se necessário |
| S3 | Infra | Rate limit in-memory | **Média** | `rate_limit_service.py` | Redis ou limit no gateway se N>1 réplicas |
| S4 | Produto | Regras estáticas | **Baixa** | `RegrasPage.tsx` | Fonte única da verdade |
| S5 | E-mail | Exposição de tokens em log | **Baixa** | `email_service` / convites | Evitar logar PII excessivo; revisar níveis |

---

## 16. Escalabilidade e manutenção

### Respostas explícitas (pedido)

| Pergunta | Resposta |
| -------- | -------- |
| Estrutura escala para todos os usuários da empresa? | Provavelmente **sim** em cenário único tenant e centenas/milhares de usuários, com PostgreSQL dimensionado. |
| Backend aguenta volume esperado? | **Não testado sob carga**; arquitetura síncrona FastAPI adequada para MVP. |
| Banco preparado para ranking? | Query agregada com joins — OK até volume moderado; **PENDENTE** `EXPLAIN` em produção. |
| Cálculo de pontos lento? | Recálculo por jogo afeta N palpites daquele jogo — tipicamente aceitável. |
| Concorrência / duplicar palpites? | **Constraint única** impede duplicata; race pode gerar erro 409 — aceitável. |
| Manutenção por outro dev? | **Sim**, com curva suave. |

---

## 17. Qualidade do código

| Área | Problema | Impacto | Sugestão |
| ---- | -------- | ------- | -------- |
| Front | `RegrasPage` hardcoded | Confusão | Buscar config da API |
| Front | Páginas grandes | Manutenção | Extrair subcomponentes |
| Back | Lógica de prazo espalhada | Complexidade | Documentar matriz de bloqueios |
| Testes | Cobertura parcial desconhecida | Regressão | Medir cobertura e ampliar |
| Docs | README raiz ausente | Onboarding | Adicionar guia único |

---

## 18. Riscos técnicos (priorizados)

1. **Configuração fraca de JWT em produção** (severidade **Alta** se não corrigido).
2. **Isolamento multi-empresa incompleto** no ranking e possivelmente em outras listas ( **Média/Alta** ).
3. **Rate limiting não distribuído** ( **Média** em múltiplas instâncias).
4. **Dessincronização regras UI vs. backend** ( **Média** de produto/reputação).
5. **Operação de mata-mata complexa** — dependência de dados admin corretos ( **Média** ).

---

## 19. Riscos de produto

- Usuário confiar nas **regras estáticas** e contestar pontuação.
- **Não perceber** que palpite foi bloqueado até tentar salvar.
- Admin errar **classificado** ou placar — impacto direto em pontos (mitigação: auditoria, confirmações).
- **E-mail de convite** não entregue (modo sandbox Resend) — fricção de onboarding.

---

## 20. Recomendações priorizadas

### Prioridade 1 — Produção e segurança

| # | Descrição | Motivo | Impacto | Complexidade | Área |
| - | --------- | ------ | ------- | ------------ | ---- |
| P1.1 | Secrets fortes + HTTPS + cookie `secure` | Reduz sequestro de sessão | Alto | Baixa | Back/Ops |
| P1.2 | Revisar isolamento **empresa** em ranking/listagens | Privacidade e justiça do bolão | Alto | Média | Back |
| P1.3 | Plano de backup e migrações | Integridade | Alto | Média | DB/Ops |

### Prioridade 2 — Regra de negócio e integridade

| # | Descrição | Motivo | Impacto | Complexidade | Área |
| - | --------- | ------ | ------- | ------------ | ---- |
| P2.1 | Endpoint leitura resultado especial autenticado | Transparência | Médio | Baixa | Back/Front |
| P2.2 | Documentar e testar regra de placar com prorrogação | Evita disputa | Médio | Média | Back |
| P2.3 | Validações duras de placar (0–n máx.) | Integridade | Médio | Baixa | Back |

### Prioridade 3 — UX/UI

| # | Descrição | Motivo | Impacto | Complexidade | Área |
| - | --------- | ------ | ------- | ------------ | ---- |
| P3.1 | Regras dinâmicas | Confiança | Médio | Média | Front/Back |
| P3.2 | Resumo “o que falta palpitar” | Engajamento | Médio | Média | Front |

### Prioridade 4 — Escalabilidade e manutenção

| # | Descrição | Motivo | Impacto | Complexidade | Área |
| - | --------- | ------ | ------- | ------------ | ---- |
| P4.1 | Rate limit compartilhado | Consistência multi-instância | Médio | Média | Back |
| P4.2 | Docker + README raiz | Deploy reprodutível | Médio | Média | Ops |

---

## 21. Roadmap sugerido até produção

### Etapa 1 — Auditoria e travas críticas

- **Objetivo:** segurança e tenant.  
- **Tarefas:** secrets; filtro empresa; revisar cookies; revisar logs.  
- **Aceite:** check-list OWASP básico + teste manual multi-empresa.  
- **Risco se omitido:** vazamento de dados / contestação legal interna.

### Etapa 2 — Fluxo de palpites e ranking

- **Objetivo:** consistência percebida.  
- **Tarefas:** alinhar regras na UI; mensagens de bloqueio; validação placar.  
- **Aceite:** usuário piloto entende pontos sem suporte.  
- **Risco:** churn e tickets.

### Etapa 3 — Admin operacional

- **Objetivo:** Copa sem incidentes.  
- **Tarefas:** playbooks admin; dupla confirmação em resultado; monitorar auditoria.  
- **Aceite:** simulação de rodada completa.  
- **Risco:** ranking errado.

### Etapa 4 — Mata-mata e especiais

- **Objetivo:** fechamento do torneio.  
- **Tarefas:** testes de pontuação mata-mata; publicação resultado especial leve.  
- **Aceite:** casos de teste documentados passando.  
- **Risco:** premiação incorreta.

### Etapa 5 — UX/UI e responsividade

- **Objetivo:** escala de uso mobile.  
- **Tarefas:** testes em devices; ajustes de tabela/scroll.  
- **Aceite:** QA checklist.  
- **Risco:** abandono mobile.

### Etapa 6 — Testes, seed final e deploy

- **Objetivo:** go-live.  
- **Tarefas:** pipeline CI, staging, smoke tests, plano de rollback.  
- **Aceite:** deploy repetível.  
- **Risco:** indisponibilidade na abertura.

---

## 22. Conclusão

- **O projeto está bem encaminhado** para um bolão corporativo MVP com intenção de evoluir até 2026: base técnica sólida, domínio modelado e testes pontuais importantes já presentes.  
- **Não está “pronto para produção” sem** endurecimento de segurança/config, clarificação multi-tenant (se aplicável) e alinhamento das regras apresentadas ao usuário.  
- **O que mais preocupa:** mistura de **multi-empresa** com agregações **globais** (ranking) e **configuração de segurança padrão** (`JWT_SECRET`).  
- **O que está sólido:** **autorização admin no backend**, **unicidade de palpites**, **serviço de pontuação centralizado** e **fluxo de recálculo** após resultados.  
- **Próxima ação recomendada:** decidir modelo de produto (**um bolão global vs. um por empresa**) e implementar o filtro correspondente em **ranking, jogos e palpites**; em paralelo, **check-list de produção** (secrets, HTTPS, observabilidade).  
- **Antes de abrir para a empresa toda:** executar **Prioridade 1** e **P2.1/P2.2** da seção 20, mais um **teste de carga leve** e **runbook** para o admin.

---

*Documento gerado por análise estática do repositório; não substitua testes de integração, pentest ou revisão de infraestrutura real de deploy.*
