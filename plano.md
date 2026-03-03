# BOLÃO DA COPA — PLANO EXECUTÁVEL PARA O CURSOR
MVP Responsivo (Mobile + Desktop) — Dark Mode Padrão  
Stack fixa: Next.js (App Router) + TypeScript + Tailwind + Prisma + Supabase Postgres  
Auth interna (bcrypt).  
Pontuação on-the-fly.  
Sem APIs externas.  
Timezone oficial: America/Sao_Paulo (armazenar UTC no banco).

---

# REGRAS FIXAS (NÃO ALTERAR)

1) Palpites pré-torneio obrigatórios antes dos grupos:
   - Campeão (dropdown pesquisável de seleções)
   - Bola de Ouro (texto)
   - Chuteira de Ouro (texto)
   - Luva de Ouro (texto)

2) Fase de grupos:
   - Palpite = placar em 90 minutos
   - Lista única com chips de Grupo e Rodada
   - Confirmar e Trancar (locked_at)
   - Deadline global = 1h antes do primeiro jogo (Brasília)

3) Mata-mata:
   - Admin cadastra partidas
   - Palpite = placar 90min + classificado obrigatório se empate
   - Deadline por jogo = 1h antes do kickoff (Brasília)

4) Pontuação:
   - EXACT: placar 90min exato
   - OUTCOME:
       - Grupos: acertou vencedor/empate
       - Mata-mata: acertou classificado
   - Pontos vêm de scoring_config

5) Participação após início: permitida (mas grupos/pré-torneio travados)

6) Responsividade obrigatória em TODOS os commits.

---

# ESTRUTURA DE PASTAS (FIXA)

app/
  layout.tsx
  page.tsx
  login/
  signup/
  group-picks/
  group-picks/review/
  tournament-picks/
  knockout/
  ranking/
  my-score/
  admin/
    page.tsx
    teams/
    import/
    matches/
    knockout/
    goals/
    audit/

components/
  ui/
    Card.tsx
    Button.tsx
    Chip.tsx
    LockBadge.tsx
    ProgressBar.tsx
    ScoreInput.tsx
  layout/
    AppShell.tsx
    Topbar.tsx

lib/
  auth.ts
  db.ts
  deadlines.ts
  scoring.ts
  timezone.ts
  utils.ts

prisma/
  schema.prisma
  seed.ts

---

# SEQUÊNCIA EXECUTÁVEL DE COMMITS

---

## COMMIT 1
**chore: scaffold do projeto**

Implementar:
- Next.js + TypeScript
- Tailwind
- Estrutura de pastas conforme acima
- ESLint + Prettier

DoD:
- Projeto roda
- Tailwind ativo
- Página inicial básica

---

## COMMIT 2
**feat: tema dark + tokens**

Criar:
- colors.ts ou variáveis Tailwind:
  - bg-primary (grafite)
  - bg-card
  - accent-green
  - accent-gold
  - text-primary
- Dark mode padrão

DoD:
- Fundo grafite
- Card padrão visível
- Sem branco puro

---

## COMMIT 3
**feat: AppShell responsivo**

Criar:
- AppShell com Topbar fixa
- Container central com max-w-screen-xl
- Padding mobile adequado

Topbar deve conter:
- Título “Bolão da Copa”
- Placeholder de deadline

DoD:
- Layout consistente
- Funciona 360px e desktop

---

## COMMIT 4
**feat: componentes UI base**

Criar:
- Card
- Button (primary/secondary)
- Chip
- LockBadge
- ProgressBar

Criar rota `/ui-demo` para validar componentes.

DoD:
- Componentes visualmente consistentes
- Testados mobile

---

## COMMIT 5
**feat: ScoreInput**

Componente:
- Input numérico
- Botões + e –
- Limite 0–20
- disabled quando travado

DoD:
- Funciona mobile
- Não quebra layout

---

## COMMIT 6
**chore: Prisma + Supabase**

- Configurar Prisma
- Conectar ao Supabase
- Criar .env
- Testar migrate

DoD:
- Conexão funcionando

---

## COMMIT 7
**feat: schema v1**

Implementar schema conforme:

users
teams
matches
players
match_goals
user_tournament_picks
user_match_picks
scoring_config
audit_logs

Seed:
- scoring_config default (exact=3, outcome=1)

DoD:
- migrate executado
- seed rodando

---

## COMMIT 8
**feat: auth interna**

- Signup
- Login
- bcrypt hash
- Cookie de sessão
- role admin via DB

DoD:
- Login funciona
- Rotas protegidas

---

## COMMIT 9
**feat: proteção de rotas**

- Middleware de autenticação
- /admin exige role=admin

DoD:
- Usuário comum não acessa admin

---

## COMMIT 10
**feat(admin): Teams CRUD**

Tela:
- /admin/teams

Campos:
- name
- code
- group_letter

DoD:
- Criar/editar/excluir
- Responsivo

---

## COMMIT 11
**feat(admin): Import CSV**

Tela:
- /admin/import

Fluxo:
- Upload CSV
- Validar cabeçalho
- Converter horário Brasília → UTC
- Criar matches stage=GROUP

Registrar audit log.

DoD:
- Importa jogos
- Não duplica indevidamente

---

## COMMIT 12
**feat: Palpites do Torneio**

Tela:
- /tournament-picks

Campos:
- champion_team_id (dropdown pesquisável)
- golden_ball
- golden_boot
- golden_glove

Bloquear se deadline global passou.

DoD:
- Salva corretamente
- Responsivo

---

## COMMIT 13
**feat: deadline global**

Implementar lib/deadlines.ts:

- Buscar menor kickoff GROUP
- Subtrair 1h
- Comparar com agora (Brasília)

Validar no backend.

DoD:
- Bloqueia corretamente

---

## COMMIT 14
**feat: Palpites Grupos**

Tela:
- /group-picks

Listar todos matches GROUP
Salvar em user_match_picks

Progresso x/48

DoD:
- Lista responsiva
- Salva picks

---

## COMMIT 15
**feat: Revisão e Trancar**

Tela:
- /group-picks/review

Mostrar picks read-only
Confirmar → set locked_at

DoD:
- Após confirmar não edita mais

---

## COMMIT 16
**feat: enforce travas backend**

Rejeitar updates se:
- deadline global passou
- locked_at preenchido

DoD:
- Segurança garantida

---

## COMMIT 17
**feat(admin): lançar resultados**

Tela:
- /admin/matches

Editar:
- score_a
- score_b
- status

Audit log obrigatório.

DoD:
- Resultado salva
- Log registra

---

## COMMIT 18
**feat: scoring on-the-fly**

lib/scoring.ts:

Funções:
- calculateMatchPoints(userPick, match, config)
- calculateUserTotal(userId)

Implementar EXACT e OUTCOME conforme regras.

DoD:
- Pontos corretos

---

## COMMIT 19
**feat: Minha Pontuação**

Tela:
- /my-score

Mostrar:
- palpite
- resultado
- reason
- pontos

DoD:
- Transparente
- Responsivo

---

## COMMIT 20
**feat: Ranking**

Tela:
- /ranking

Ordenar por:
1. total pontos
2. exatos
3. outcomes

Destacar usuário atual.

Responsivo:
- Mobile vira cards

DoD:
- Ranking consistente

---

## COMMIT 21
**feat(admin): cadastro mata-mata**

Tela:
- /admin/knockout

Criar matches com stage R16/QF/SF/F/THIRD

DoD:
- Jogos criados corretamente

---

## COMMIT 22
**feat: palpites mata-mata**

Tela:
- /knockout

Inputs:
- placar 90min
- se empate → selecionar classificado

Trava 1h antes kickoff.

DoD:
- Funciona mobile
- Validação correta

---

## COMMIT 23
**feat: pontuação mata-mata**

Admin deve registrar classificado real.

Pontuação:
- EXACT → placar 90
- OUTCOME → classificado

DoD:
- Calcula corretamente

---

## COMMIT 24
**feat(admin): gols e jogadores**

Tela:
- /admin/goals

Dropdown jogadores por team
Criar se não existir (name_norm)

Audit log.

DoD:
- Não duplica jogadores
- Registro funcional

---

## COMMIT 25
**feat: auditoria**

Tela:
- /admin/audit

Listar logs
Mostrar before/after formatado

DoD:
- Funciona
- Responsivo

---

## COMMIT 26
**polish: UI final**

- Pattern sutil de campo no header
- Ajustes mobile
- Skeleton loading
- Microinterações leves

DoD:
- Layout moderno
- Clean
- 360px perfeito
- Desktop elegante

---

# CHECKLIST FINAL

- Testado em 360px
- Testado em desktop
- Deadlines funcionando
- Travas backend funcionando
- Ranking correto
- Admin funcional
- Sem dependência externa

---

FIM DO PLANO EXECUTÁVEL