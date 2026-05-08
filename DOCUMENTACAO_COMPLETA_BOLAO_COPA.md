# Documentação Completa — Bolão da Copa

## 1. Visão geral

A aplicação é um bolão corporativo da Copa do Mundo 2026, com backend em FastAPI e frontend React/Vite. O objetivo do produto é permitir que usuários internos façam palpites por jogo e palpites especiais, com cálculo de pontuação e ranking geral.

Perfis identificados:
- Usuário comum (`tipo_usuario=usuario`): faz palpites, acompanha jogos, especiais, ranking e regras.
- Administrador (`tipo_usuario=admin`): gerencia usuários, países, jogos, resultados, pontuação configurável e marcadores do Brasil.

Fluxo principal:
- Login -> (se primeiro acesso, onboarding) -> palpites em `Palpites` -> especiais em `Especiais` -> acompanhamento em `Ranking`.
- Admin opera via aba `Admin`, alimentando dados oficiais e acionando recálculos por consequência de atualização de resultados.

Estado atual (análise objetiva):
- **Partes maduras**: autenticação JWT básica, proteção backend por papel, fluxo de palpites com bloqueio temporal, cálculo de pontuação por jogo/especiais, ranking e UI principal responsiva.
- **Partes parciais**: insights de ranking recém-introduzidos, alguns textos/regras ainda em transição, administração concentrada em uma tela extensa.
- **Partes frágeis**: token em `localStorage` (risco residual de XSS) e ausência de middleware de CORS explícito em `main`.
- **Qualidade técnica frontend (ciclo atual)**: `npm run lint` sem erros bloqueantes e `npm run build` concluído; pendências de lint tratadas nos arquivos críticos mapeados.

---

## 2. Arquitetura do projeto

### Stack e bibliotecas principais

- Frontend: React 19 + TypeScript + Vite + React Router + React Query + Framer Motion.
- Backend: FastAPI + SQLAlchemy + Pydantic + python-jose (JWT) + passlib/bcrypt.
- Banco: PostgreSQL em runtime normal; SQLite em memória para testes.
- Migrations: Alembic (`alembic/versions`).

### Estrutura de pastas (macro)

- `app/`: backend (rotas, serviços, models, schemas, auth).
- `frontend/src/`: páginas, componentes, tipos, auth context, utilitários visuais e API client.
- `alembic/`: migrations.
- `tests/`: testes de permissão, bloqueios, SQL injection e ranking.
- `scripts/`: seeds utilitários.
- `static/`: assets estáticos servidos pelo backend (ex.: bandeiras).

### Rotas frontend

Em `frontend/src/App.tsx`:
- Públicas: `/login`, `/primeiro-acesso`.
- Protegidas: `/jogos`, `/especiais`, `/regras`, `/ranking`.
- Admin: `/admin` (guard visual + checagem backend nas APIs).

### Rotas backend/API

Principais prefixes:
- `/auth`, `/usuarios`, `/paises`, `/jogos`, `/grupos`, `/palpites-jogos`, `/palpites-especiais`, `/resultados-especiais`, `/marcadores-brasil`, `/configuracao-bolao`, `/configuracao-pontuacao-fase`, `/ranking`, `/health`.

### Onde ficam regras e responsabilidades

- Regras de negócio: `app/services/*` (pontuação, bloqueios, ranking, etc.).
- Regras de autorização: `app/auth/dependencies.py`.
- Regras visuais/UI: `frontend/src/pages` + `frontend/src/components`.
- Chamadas de API frontend: `frontend/src/lib/api.ts`.
- Models/schemas/tabelas: `app/models`, `app/schemas`, migrations em `alembic/versions`.

### Execução local

- Backend: `py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend: `cd frontend && npm run dev`

Observações de runtime:
- Em dev, backend retorna 404 em `/` quando `frontend/dist` não existe, incentivando uso do Vite.
- Em build de produção com `frontend/dist`, FastAPI serve SPA.
- O frontend oficial da aplicação é React/Vite.

### Docker, seed e config

- **Docker**: NÃO IDENTIFICADO.
- `.env` suportado via `pydantic-settings` (`app/core/config.py`).
- Seeds existentes em `scripts/` (admin, países, configuração).
- Migrations ativas com Alembic.

---

## 3. Perfis de usuário e permissões

### Usuário comum

- Acesso via login (`/auth/login`).
- Visualiza: jogos, grupos/tabela, especiais, ranking, regras.
- Pode editar: perfil no primeiro acesso e palpites enquanto abertos.
- Não acessa: endpoints/admin features (bloqueio backend por `require_admin`).
- Abas disponíveis: `Palpites`, `Especiais`, `Regras`, `Ranking`.
- Ações bloqueadas por regra temporal:
  - Palpite jogo (grupos): jogos da rodada X fecham 1h antes do jogo mais cedo da própria rodada X.
  - Palpite jogo (mata-mata): jogos da fase Y fecham 1h antes do jogo mais cedo da própria fase Y.
  - Especiais: fecham 1h antes do jogo mais cedo da 1ª rodada da fase de grupos e não reabrem.
  - Marcadores BR: segue bloqueio do jogo.
- Persistência de palpites:
  - Jogos: `palpites_jogos` (único por usuário+jogo).
  - Especiais: `palpites_especiais` (único por usuário).

### Admin

- Identificação por `tipo_usuario='admin'` no token (via usuário carregado).
- Acesso à aba admin no frontend e APIs protegidas no backend.
- Pode:
  - gerenciar usuários (`/usuarios*`);
  - gerenciar países (`/paises` POST/PUT);
  - criar/editar jogo e lançar resultados (`/jogos*`);
  - gerenciar marcadores BR candidatos e resultado (`/marcadores-brasil*`);
  - operar a aba `Especiais` como painel único para:
    - configurar pontuação (`/configuracao-bolao`, `/configuracao-pontuacao-fase`);
    - definir resultados especiais (`/resultados-especiais`);
    - finalizar especiais (`PATCH /resultados-especiais/finalizar`).
- Impacto em cálculo/ranking:
  - alterações de resultado disparam recálculo de palpites relacionados.

### Proteção frontend vs backend

- Frontend: `AdminRoute` impede navegação visual.
- Backend: checagem obrigatória real via `require_admin` em rotas administrativas.
- Conclusão: proteção crítica não depende apenas de frontend.

---

## 4. Autenticação e sessão

### Fluxo atual

- Login em `/auth/login` com email/senha.
- Backend valida hash de senha e `ativo`.
- Emite JWT access token (`HS256`) com `sub`, `iat`, `exp`.
- Frontend salva token em `localStorage` (`bolao_access_token`) e envia em `Authorization: Bearer`.
- Carrega usuário atual via `/auth/me`.
- Logout remove token local.
- Token inválido/expirado em requisição -> frontend limpa token e dispara evento de logout.

### Primeiro acesso

- Se `primeiro_login=true`, usuário vai para `/primeiro-acesso`.
- Endpoint `/auth/primeiro-acesso` conclui onboarding e define senha final.

### Expiração e renovação

- Access token com expiração configurável (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`).
- Refresh token implementado via cookie HttpOnly (`bolao_refresh_token`) com rotação por uso em `/auth/refresh`.

### Proteção por URL

- Frontend usa `ProtectedRoute` e `AdminRoute`.
- Backend protege dados com dependências auth e role.

### Possíveis falhas de autenticação e autorização

- Access token em `localStorage` ainda exposto a risco de exfiltração em cenário de XSS (se houver brecha).
- Refresh token com rotação reduz risco de sessão longa sem renovação controlada.
- Revogação de refresh token é aplicada no logout e na rotação; access token segue dependente da expiração.
- Bypass por URL admin no frontend não dá acesso efetivo às ações críticas por causa do backend.
- Endpoints admin possuem validação backend de papel (positivo).

---

## 5. Funcionalidades do usuário comum

### 5.1 Palpites

#### Objetivo da aba
Permitir preenchimento e atualização de palpites de jogos, em duas visões (`Cronológico` e `Por grupo`), usando a mesma base de dados.

#### O que o usuário vê
- Seletor `Cronológico / Por grupo`.
- Filtro de status `Em aberto / Fechados`.
- Cards de jogo com bandeiras, seleção, fase, data/hora, status.
- Stepper de placar.
- Para mata-mata: seletor de classificado.
- Para jogos do Brasil: bloco expansível de marcadores (autocomplete + quantidade).
- Resultado oficial (se disponível) e pontos obtidos.
- Na visão por grupo: seletor de grupo + tabela de classificação + lista de jogos.

#### O que o usuário pode fazer
- Criar palpite.
- Atualizar palpite enquanto aberto.
- Informar classificado no mata-mata.
- Salvar marcadores BR (após ter palpite de jogo salvo).

#### Dados usados
- `/jogos/cronologico`, `/palpites-jogos/me`, `/paises`, `/marcadores-brasil/candidatos`, `/grupos`, `/grupos/{grupo}/tabela`.

#### Regras de negócio aplicadas
- Bloqueio temporal por conjunto:
  - rodada de grupos X: `min(data_jogo da rodada X) - 1h`;
  - fase de mata-mata Y: `min(data_jogo da fase Y) - 1h`.
- Jogo finalizado é não editável.
- Mata-mata exige classificado.
- Marcadores BR apenas para jogos que envolvem BR.
- Sincronização entre visões ocorre por uso da mesma estrutura `palpiteMap` em memória e mesma tabela backend.

#### Estados visuais
- Carregando (`Skeleton`), vazio (`EmptyState`), aberto, bloqueado, finalizado, salvando, salvo.

#### Problemas encontrados
- Texto/semântica de fechado/finalizado pode gerar dúvida para usuário não técnico.
- Tela concentra bastante informação no card para jogos com muitas regras.

#### Melhorias recomendadas
- Microcopy mais explícita para “prazo de edição”.
- Indicador visual de deadline por jogo.
- Histórico de alterações do palpite (opcional futuro).

### 5.2 Especiais

#### Objetivo da aba
Coletar palpites especiais do torneio.

#### O que o usuário vê
- Campos com `CountrySelect` para: campeão, vice, 3º lugar, país do artilheiro.
- Resumo com bandeiras.
- Pontuação por categoria (quando disponível).
- Banner de bloqueio quando não editável.

#### O que o usuário pode fazer
- Criar primeiro palpite especial.
- Atualizar enquanto aberto.

#### Dados usados
- `/palpites-especiais/me`, `/paises`, `POST /palpites-especiais`, `PUT /palpites-especiais/me`.

#### Regras de negócio aplicadas
- Bloqueio via backend (`palpites_especiais_esta_bloqueado`) em `min(data_jogo da 1ª rodada de grupos) - 1h`.
- Validação de país existente.
- Um registro por usuário.

#### Estados visuais
- Carregando, editável, bloqueado, salvo/atualizado.

#### Problemas encontrados
- Necessidade de manter documentação e material de apoio alinhados ao modelo atual (pódio + país do artilheiro).

#### Melhorias recomendadas
- Manter mensagem de prazo com data/hora explícita e referência ao conjunto (rodada/fase).

### 5.3 Classificação/Grupos

#### Objetivo da aba
Exibir classificação oficial por grupo e permitir palpites no contexto de grupo.

#### O que o usuário vê
- Tabela com posição, país, pontos, jogos, vitórias, empates, derrotas, gols pró/contra, saldo.

#### Dados usados
- `/grupos`, `/grupos/{grupo}/tabela`.

#### Regras de negócio aplicadas
- Cálculo baseado em resultados oficiais de jogos, não nos palpites.
- Desempate implementado no serviço de grupo (pontos/saldo/gols etc.; fallback conforme implementação).

#### Problemas encontrados
- Fluxo consolidado em `JogosPage` para visão por grupo e cronológica.

#### Melhorias recomendadas
- Manter documentação e navegação alinhadas ao fluxo único de palpites.

### 5.4 Ranking

#### Objetivo da aba
Mostrar classificação geral de usuários por pontos.

#### O que o usuário vê
- Destaque do próprio usuário.
- Top 3 em pódio com foto/initials.
- Lista posições subsequentes.
- Blocos de insights: `Resumo geral` e `Meu resumo`.

#### Dados usados
- `/ranking` e `/ranking/insights`.

#### Regras de negócio aplicadas
- Total = pontos jogos + pontos especiais + bônus BR.
- Ordenação por total desc, desempate por nome (atual).

#### Problemas encontrados
- Critério formal de desempate além de nome: **PENDENTE DE DEFINIÇÃO** de produto.
- Insights ainda sem refinamento de linguagem/explicabilidade.

#### Melhorias recomendadas
- Exibir legenda de critério de desempate.
- Permitir filtro por fase/período no ranking (futuro).

---

## 6. Área Admin

### Gestão de jogos

- **Objetivo**: cadastrar e operar jogos de grupos e mata-mata.
- **Tela**: `frontend/src/pages/AdminPage.tsx` seção `AdminJogos`.
- **Navegação Admin**: aba `Config` foi consolidada em `Especiais`; configurações e resultados especiais ficam no mesmo painel.
- **UI de seleção**: cadastro guiado migrado de `select` nativo para dropdown customizado (`SelectInput`) para consistência visual em dark/light mode.
- **Endpoints**: `POST /jogos`, `PUT /jogos/{id}`, `PATCH /jogos/{id}/resultado`, `PATCH /jogos/{id}/finalizar`.
- **Tabelas**: `jogos`, impacto indireto em `palpites_jogos`.
- **Validações**:
  - fase/grupo/rodada conforme `tipo_fase`;
  - países distintos e existentes;
  - classificado obrigatório para finalizar mata-mata.
- **Permissão**: `require_admin`.
- **Riscos**:
  - operação manual intensa em painel único pode elevar erro operacional.
- **Melhorias**:
  - wizard com confirmação final e validações contextuais mais guiadas.

### Resultados e recálculo

- **Objetivo**: registrar resultado oficial e refletir pontuação.
- **Comportamento**:
  - salvar resultado chama recálculo de palpites do jogo.
  - finalizar jogo também recalculta.
- **Risco**:
  - trilha de auditoria depende de manutenção contínua da cobertura em novas rotas administrativas.
- **Melhoria**:
  - log de auditoria por alteração administrativa.

### Mata-mata

- Suportado por `tipo_fase='mata_mata'`, `classificado_id`, campos de prorrogação/pênaltis.
- Fases canônicas disponíveis no backend (`dezesseis_avos`, `oitavas`, `quartas`, `semi`, `terceiro_lugar`, `final`).
- Encadeamento automático de chaveamento: NÃO IDENTIFICADO (não implementado).

### Apostas especiais (admin)

- Resultado especial é definido em `/resultados-especiais` (admin).
- Recalculo global de especiais disponível via `/palpites-especiais/recalcular`.
- Risco de inconsistência de domínio legado vs novo modelo (campos antigos coexistentes).

### Usuários

- Listar, criar, editar, ativar/desativar e resetar senha.
- Escalonamento de privilégio:
  - depende de segurança de endpoint `/usuarios` e role.
  - atualmente protegido por `require_admin`.

---

## 7. Regras de negócio e pontuação

### Palpites de jogos

- Acerto de placar exato -> `pontos_placar_exato`.
- Acerto de resultado (vitória/empate/derrota) -> `pontos_resultado_correto`.
- Mata-mata:
  - inclui pontos de classificado (`pontos_classificado_mata_mata`) quando bate `classificado_id`.
- Sem palpite: zero.
- Após prazo: backend recusa criação/edição.

### Apostas especiais

- Pontuam por categorias de especiais.
- Resultado só vale quando resultado especial está `finalizado`.
- Bloqueio temporal para criação/edição: 1h antes do jogo mais cedo da 1ª rodada de grupos; após isso, não reabre.
- Modelo consolidado em pódio + país do artilheiro.

### Bônus (Marcadores BR)

- Só para jogos envolvendo Brasil.
- Pontuação separa:
  - acertar marcador;
  - acertar quantidade exata.
- Normalização textual para comparação.
- Recalcula ao salvar resultado de marcadores.

---

## 8. Banco de dados

### Tabelas identificadas

- `usuarios`
- `paises`
- `jogos`
- `palpites_jogos`
- `palpites_especiais`
- `resultados_especiais`
- `marcadores_brasil_palpite`
- `marcadores_brasil_resultado`
- `configuracoes_bolao`
- `pontuacao_fase`
- `candidatos_marcador_brasil` (model existente)

### Relacionamentos críticos

- `palpites_jogos.usuario_id -> usuarios.id`
- `palpites_jogos.jogo_id -> jogos.id`
- `palpites_especiais.usuario_id -> usuarios.id`
- `jogos.pais_casa_id/pais_fora_id/classificado_id -> paises.id`
- `marcadores_brasil_palpite.palpite_jogo_id -> palpites_jogos.id` (cascade delete)
- `marcadores_brasil_resultado.jogo_id -> jogos.id`

### Constraints e integridade

- Único palpite por usuário+jogo (`uq_palpite_usuario_jogo`).
- Único palpite especial por usuário (`uq_palpite_especial_usuario`).
- Índices em chaves de busca relevantes (email, FKs de palpites).
- Ranking não é tabela persistida; é agregado dinâmico.

### Pontos críticos no banco

- Constraint de palpite por usuário/jogo: **OK**.
- Constraint de especiais por usuário: **OK**.
- Integridade jogos/grupos: parcial (regra forte no service; DB não impõe check formal complexo).
- Integridade usuários/permissões: baseada em coluna `tipo_usuario`.
- Dados órfãos: mitigado por FKs; verificar cascatas adicionais desejáveis.
- Migrações: presentes e versionadas via Alembic; sem evidência de alteração manual fora migration.

---

## 9. Auditoria de segurança

### SQL Injection

- Uso predominante de SQLAlchemy ORM e `select` parametrizado.
- Não foram encontrados SQLs de concatenação com input em rotas/serviços principais.
- Teste dedicado `tests/test_sql_injection.py` confirma ausência de 500 em payload malicioso de grupo.
- **Risco classificado**: **Baixo**.

### Bypass de autenticação/autorização

- Backend protege recursos com `get_current_active_user`, `require_primeiro_login_concluido`, `require_admin`.
- Frontend também protege visualmente, mas backend é a camada efetiva.
- **Risco**: **Médio-baixo** (depende da proteção JWT e segredo).

### Validação de entrada

- Pydantic valida formatos e campos mínimos.
- Services reforçam regras de domínio (prazos, classificado, jogo BR etc.).
- Limite de placares “absurdos”: Mitigado com teto numérico em schemas (`le=30` para placar/pênaltis e `le=15` para quantidade de gols de marcadores BR).
- **Risco**: **Baixo**.

### Exposição de dados

- Token guardado em `localStorage`.
- Sem segredo hardcoded explícito no código além default inseguro em config (`change-me-in-production`).
- `.env.example` inclui exemplo de URL sensível; não deve ir para produção como está.
- **Risco**: **Médio**.

### CORS e headers

- Middleware CORS explícito em `app/main.py`: **NÃO IDENTIFICADO**.
- Headers de segurança adicionais (CSP, HSTS, etc.): **NÃO IDENTIFICADO**.
- **Risco**: **Médio** (especialmente em deploy aberto).

### CSRF/XSS

- Autenticação por bearer em header (não cookie), reduz superfície CSRF clássica.
- Sem `dangerouslySetInnerHTML` identificado no frontend lido.
- Persistência de token no `localStorage` aumenta impacto potencial de XSS.
- **Risco**: **Médio**.

### Rate limiting e abuso

- Rate limiting em autenticação: Mitigado em `/auth/login` (tentativas inválidas) e `/auth/refresh` por janela configurável.
- Proteção contra brute force de login: Mitigado via limitação por chave de cliente/identificador e janela de tempo.
- **Risco**: **Baixo** (depende de calibração dos limites por ambiente/carga).

### Principais achados de segurança (resumo objetivo)

- `app/core/config.py`: segredo JWT default fraco em código (mitigável por `.env`, mas arriscado por padrão).
- `frontend/src/lib/api.ts`: token em `localStorage`.
- `app/main.py`: ausência de CORS explícito.
- Rate limiting aplicado em `/auth/login` e `/auth/refresh`.
- Trilha de auditoria administrativa implementada para rotas de mutação admin.

---

## 10. UX/UI e efeitos visuais

### Panorama visual

- Layout moderno com tema dark/light, cards glassmorphism e animações leves.
- Navegação principal com topbar + bottom nav.
- Toaster global para feedback.
- Estados de carregamento (`Skeleton`) e vazio (`EmptyState`) bem distribuídos.

### Elementos relevantes e avaliação

- **Cards de jogo (`GameCard`)**:
  - claros para cenário normal;
  - ficam densos em mata-mata + BR + resultado.
- **ScoreStepper**:
  - bom para mobile;
  - estado read-only consistente para jogos bloqueados/finalizados.
- **CountrySelect/Autocomplete**:
  - melhora preenchimento e reduz erro de digitação.
- **Tabela de grupos**:
  - funcional e contextualizada na aba de palpites.
- **Ranking com pódio**:
  - boa percepção de status;
  - insights ainda podem evoluir em clareza de narrativa.

### Acessibilidade e consistência

- Sem auditoria A11y automatizada identificada.
- Rótulos principais presentes, mas cobertura completa de teclado/ARIA: **NÃO IDENTIFICADO**.

### Melhorias recomendadas de UX

- Mostrar “fecha em X” por jogo.
- Diferenciar visualmente “fechado por prazo” e “finalizado oficial”.
- Reduzir complexidade da tela Admin em subfluxos menores.

---

## 11. Fluxos completos

### Fluxo do usuário comum

1. Acessa aplicação.
2. Faz login.
3. Se primeiro acesso: completa onboarding e redefine senha.
4. Entra em `Palpites`.
5. Escolhe `Cronológico` ou `Por grupo`.
6. Preenche placar (e classificado em mata-mata).
7. Salva/atualiza palpite.
8. (Se jogo BR) informa marcadores.
9. Acompanha fechamento por prazo.
10. Após finalização oficial, visualiza pontos.
11. Consulta `Ranking`.
12. Preenche `Especiais` até bloqueio.

### Fluxo do admin

1. Faz login.
2. Acessa `Admin`.
3. Cadastra/edita jogos.
4. Lança resultados e finaliza jogos.
5. Em jogo BR finalizado, informa marcadores reais.
6. Mantém candidatos de marcadores BR.
7. Na aba `Especiais`, configura pontuação geral e por fase.
8. Na aba `Especiais`, define e finaliza resultados especiais.
9. Recalcula quando necessário (endpoints de recálculo).
10. Valida efeito no ranking.

### Fluxos de erro

- Não logado -> 401 backend / redirecionamento frontend.
- Token expirado -> logout automático frontend.
- API indisponível -> erro em toast.
- Salvar palpite fora do prazo -> 400 com mensagem de prazo encerrado.
- Usuário comum em endpoint admin -> 403.
- Resultado inválido mata-mata sem classificado -> 400.
- Ranking indisponível -> estado de erro de chamada (toast/falha carregamento).

---

## 12. Bugs, inconsistências e riscos

| ID | Área | Tipo | Descrição | Severidade | Impacto | Recomendação |
| -- | ---- | ---- | --------- | ---------- | ------- | ------------ |
| B01 | Segurança | Risco de segurança | JWT secret default fraco em config pode vazar para ambiente mal configurado | Alta | Compromete autenticação | Exigir secret forte por ambiente e falhar startup sem override |
| B02 | Segurança | Risco de segurança | Token em `localStorage` aumenta risco em cenário XSS | Média | Sequestro de sessão | Considerar estratégia com cookie `HttpOnly` + proteção adicional |
| ~~B03~~ | ~~Segurança~~ | ~~Mitigado~~ | ~~Rate limit aplicado em login e refresh por janela~~ | ~~Baixa~~ | ~~Reduz brute force/abuso~~ | ~~Manter ajuste de limites por ambiente~~ |
| ~~B04~~ | ~~Backend~~ | ~~Mitigado~~ | ~~Trilha de auditoria admin em rotas de mutação~~ | ~~Baixa~~ | ~~Melhora rastreabilidade operacional~~ | ~~Expandir cobertura quando novas rotas admin forem criadas~~ |
| ~~B05~~ | ~~Regras~~ | ~~Mitigado~~ | ~~Mensagem de especiais alinhada à regra real (edição até bloqueio)~~ | ~~Baixa~~ | ~~Reduz ruído de entendimento~~ | ~~Revisar copy sempre que regra de produto mudar~~ |
| B06 | UX | Problema de UX | Diferença fechado vs finalizado pode confundir usuário | Média | Erro de percepção | Refinar copy, badges e ajuda contextual |
| B07 | Infra/API | Risco de segurança | CORS/headers de segurança não explícitos | Média | Exposição em deploy aberto | Definir CORS por ambiente e hardening de headers |
| ~~B08~~ | ~~Dados~~ | ~~Mitigado~~ | ~~Limites máximos definidos para placar/pênaltis e quantidade de gols~~ | ~~Baixa~~ | ~~Evita payloads absurdos~~ | ~~Ajustar limites se houver necessidade de produto~~ |
| ~~B09~~ | ~~Frontend~~ | ~~Mitigado~~ | ~~Rota duplicada `/grupos` descontinuada com redirecionamento para `/jogos`~~ | ~~Baixa~~ | ~~Remove duplicidade de navegação~~ | ~~Manter fluxo único em `JogosPage`~~ |
| B10 | Produto | Regra de negócio indefinida | Critério formal de desempate no ranking além nome não explicitado | Baixa | Contestação de ranking | Definir regra oficial e exibir na UI |

---

## 13. Funcionalidades faltantes ou parciais

### Essenciais para produção

- Hardening de segurança operacional (**Pendente**):
  - política forte de JWT secret;
  - CORS/headers definidos por ambiente.
- Auditoria administrativa contínua para novas operações críticas (**Pendente** para novas rotas).

### Importantes, mas não bloqueantes

- Melhorias de UX no entendimento de bloqueios e prazos (**Pendente**, alinhado ao B06).
- Separação da tela Admin em módulos menores (**Pendente**).
- Critério de desempate formal publicado (**Pendente**, alinhado ao B10).

### Desejáveis

- Histórico de alterações por palpite/resultado.
- Observabilidade avançada (métricas de erro/performance).
- Exportações e relatórios administrativos.
- Implementação obrigatória futura de imagem de perfil opcional com fallback padrão:
  - usuário pode enviar imagem no perfil/primeiro acesso;
  - se não houver imagem válida, UI deve exibir imagem de fallback;
  - upload deve aceitar apenas arquivos de imagem permitidos;
  - upload deve aplicar limite máximo de tamanho por segurança;
  - ranking deve exibir imagem do usuário ou fallback.

---

## 14. Recomendações priorizadas

### Prioridade 1 — Segurança e integridade

- Tornar obrigatório `JWT_SECRET` forte por ambiente (**Pendente**, alinhado ao B01).
- Definir CORS explícito e headers de segurança (**Pendente**, alinhado ao B07).
- Revisar estratégia de armazenamento de sessão/token (**Pendente**, alinhado ao B02).

### Prioridade 2 — Fluxo principal do bolão

- Refinar comunicação de regras e estados em especiais (**Pendente**, alinhado ao B06).
- Melhorar comunicação de status de bloqueio por jogo.
- Garantir consistência final entre regras documentadas e comportamento de UI.

### Prioridade 3 — Admin e operação

- Quebrar `AdminPage` em submódulos para reduzir erro operacional.
- Adicionar validações de formulário mais guiadas no cadastro de jogos.
- Criar confirmação explícita para ações críticas (finalizar/resultado).

### Prioridade 4 — UX/UI

- Revisar contraste, legibilidade e estados disabled.
- Exibir deadlines e critério de desempate no ranking (**Pendente**, alinhado ao B10).
- Uniformizar mensagens de erro/sucesso em fluxos críticos.

### Prioridade 5 — Futuro

- Dashboard analítico de acertos por fase.
- Histórico de ranking por rodada/fase.
- Notificações de fechamento de palpites.

---

## 15. Conclusão

### A aplicação está pronta para produção?

**Parcialmente**. Funcionalmente, o núcleo do bolão está robusto para operação controlada. Para produção ampla, faltam endurecimentos de segurança e governança operacional.

### 5 maiores riscos hoje

1. Ajuste contínuo dos limites de rate limiting em autenticação conforme carga real.
2. JWT secret default inseguro se ambiente for mal configurado.
3. Token em `localStorage` (impacto em cenário XSS).
4. CORS/headers de segurança ainda não explícitos no `main`.
5. Manutenção da cobertura de auditoria em novas rotas administrativas.

### 5 primeiras ações recomendadas

1. Forçar secret JWT forte e fail-fast sem configuração segura.
2. Configurar CORS/headers de segurança por ambiente.
3. Revisar estratégia de armazenamento de token de acesso no frontend.
4. Garantir cobertura de auditoria em qualquer nova mutação admin.
5. Manter documentação e regras de especiais alinhadas a mudanças de produto.

### O que precisa estar resolvido antes de liberar para todos os usuários?

- Hardening mínimo de segurança (itens 1-3 acima).
- Regras de especiais estabilizadas e coerentes em backend/frontend.
- Procedimentos de operação admin com rastreabilidade.
- Checklist de regressão funcional final em cenários de fechamento e pontuação.
