# Auditoria de bypass de regras de negócio

Relatório focado em manipulação de jogos, apostas, formulários e configurações após prazo, bloqueio ou finalização. Escopo: backend (`app/`), frontend (`frontend/`), modelos SQLAlchemy, migrações Alembic, testes (`tests/`). **Não há jobs/cron** que alterem palpites ou jogos; `app/main.py` não aplica middleware de bloqueio de negócio (apenas SPA estática).

**Data da revisão:** 2026-05-11  
**Metodologia:** leitura de rotas, services, dependências de auth, modelos e fluxos UI; confronto com testes existentes.

---

## Índice

1. [Sumário executivo](#sumário-executivo)
2. [Matriz de endpoints sensíveis](#matriz-de-endpoints-sensíveis)
3. [Índice de achados](#índice-de-achados)
4. [Achados detalhados](#achados-detalhados)
5. [Front-end (defesa em profundidade)](#front-end-defesa-em-profundidade)
6. [Controles já existentes](#controles-já-existentes)
7. [Lacunas de teste recomendadas](#lacunas-de-teste-recomendadas)
8. [Referências de código](#referências-de-código)

---

## Sumário executivo

Para **participantes** (`admin`/`usuario` com onboarding concluído), o servidor costuma ser a autoridade: palpites por jogo, marcadores do Brasil e palpites especiais passam por checagens de prazo, jogo finalizado e bloqueio de especiais antes do `commit`. A UI esconde ações, mas não é a barreira principal.

Os riscos mais relevantes de **bypass ou alteração indevida de estado** concentram-se em:

- mutações de **owner** em jogos e resultados **depois** de finalizados, com recálculo de pontuação;
- **desfinalização** de resultado especial via `PUT`;
- **recálculo retroativo** de ranking ao mudar pesos de pontuação;
- **falhas de fechamento** em palpites especiais (usuário sem `empresa_id`, flag `bloqueado` só na leitura);
- **janela TOCTOU** no limite de prazo (sem trava no banco);
- **sessão** de usuário bloqueado pela equipe ainda renovável via refresh até expirar.

---

## Matriz de endpoints sensíveis

Legenda: **Auth recurso** = o ID do recurso é amarrado ao usuário/empresa no service, não só no path.

| ID | Método e rota | Quem pode | Status / bloqueio no servidor | Campos manipuláveis | Auth recurso | Race / replay | Banco |
|----|---------------|-----------|-------------------------------|---------------------|--------------|---------------|-------|
| E-01 | `GET /palpites-jogos/me` | Ativo, onboarding OK | Leitura; sem prazo | — | `usuario_id` do token | Baixo | FK |
| E-02 | `POST /palpites-jogos` | Participante | `finalizado` + `momento_fim_edicao_palpite` | `jogo_id`, placares, classificado | `usuario_id` no insert | TOCTOU; 2º POST → 409 | `uq_palpite_usuario_jogo` |
| E-03 | `PUT /palpites-jogos/{id}` | Participante | Idem E-02 | Placares / classificado (merge) | `get_by_id_for_usuario` | TOCTOU; PUT idempotente | Idem |
| E-04 | `GET/POST/PUT /palpites-especiais/me` | Leitura: onboarding; escrita: participante | `_assert_nao_bloqueado` (com ressalvas SEC-005) | Países dos especiais | 1 registro / usuário | POST duplicado → 409 | `uq_palpite_especial_usuario` |
| E-05 | `GET /palpites-especiais` | Owner | N/A | Lista global | Sem tenant | Exposição cross-tenant | — |
| E-06 | `PATCH /palpites-especiais/recalcular` | Owner | N/A | Dispara recálculo global | Sem escopo empresa | Replay idempotente | — |
| E-07 | `GET /jogos*` | Ativo | Leitura | — | Global | — | — |
| E-08 | `POST/PUT /jogos` | Owner | **Sem** guarda `finalizado` no PUT | Agenda, países, fase | Global | Mudar `data_jogo` altera prazo | FK países |
| E-09 | `PATCH /jogos/{id}/resultado` | Owner | **Sem** guarda `finalizado` | Placar, pênaltis, classificado | Global | Recálculo a cada PATCH | — |
| E-10 | `PATCH /jogos/{id}/finalizar` | Owner | Não finalizado; +2h início; placar OK | Ação | Global | Idempotente se já finalizado | `finalizado` bool |
| E-11 | `GET/POST/PUT /resultados-especiais` | Owner | `finalizado` aceito no body do PUT | Países + `finalizado` | Singleton global | PUT pode “desfinalizar” | Sem unique singleton |
| E-12 | `GET/PUT /configuracao-bolao` | Admin tenant (PUT) | Data bloqueio imutável após 1ª definição | Pontos + data | `resolve_empresa_id` | PUT pontos → recálculo empresa | `empresa_id` |
| E-13 | `PUT /configuracao-pontuacao-fase` | Admin tenant | Sem trava temporal | Pontos por fase | Tenant | Recálculo retroativo | `uq_pontuacao_fase_key` |
| E-14 | `POST/PUT /marcadores-brasil/{jogo_id}` | Participante + flag empresa | Mesmo prazo dos palpites; exige palpite | Lista marcadores | Por `usuario_id` + palpite | Sync substitui tudo | CASCADE |
| E-15 | `POST/PUT /marcadores-brasil/resultado/{jogo_id}` | Owner | **Sem** prazo / finalização | Marcadores oficiais | Global | Recálculo imediato | FK `jogo_id` |
| E-16 | `GET /marcadores-brasil/me/{jogo_id}` | Onboarding OK | Leitura; feature BR no list | — | Por usuário | — | — |
| E-17 | `PATCH /equipe/{id}/bloquear` | Admin tenant | N/A | `bloqueado` | Membro da empresa | Sessão antiga (SEC-009) | — |

---

## Índice de achados

| ID | Gravidade | Título |
|----|-----------|--------|
| [SEC-001](#sec-001--owner-altera-resultado-após-jogo-finalizado) | Alta | Owner altera resultado após jogo finalizado |
| [SEC-002](#sec-002--owner-altera-agenda-de-jogo-sem-trava-pós-finalização) | Alta | Owner altera agenda de jogo sem trava pós-finalização |
| [SEC-003](#sec-003--owner-desfinaliza-resultado-especial-via-put) | Alta | Owner desfinaliza resultado especial via PUT |
| [SEC-004](#sec-004--recálculo-retroativo-de-pontuação-por-mudança-de-regras) | Média | Recálculo retroativo de pontuação por mudança de regras |
| [SEC-005](#sec-005--bloqueio-de-palpites-especiais-ignorado-sem-empresa_id) | Média | Bloqueio de palpites especiais ignorado sem `empresa_id` |
| [SEC-006](#sec-006--flag-bloqueado-em-palpite-especial-não-aplicada-na-escrita) | Média | Flag `bloqueado` em palpite especial não aplicada na escrita |
| [SEC-007](#sec-007--janela-toctou-no-prazo-de-palpites-e-marcadores) | Média | Janela TOCTOU no prazo de palpites e marcadores |
| [SEC-008](#sec-008--marcadores-oficiais-sem-validação-contra-placar-do-brasil) | Média | Marcadores oficiais sem validação contra placar do Brasil |
| [SEC-009](#sec-009--usuário-bloqueado-pode-renovar-sessão-via-refresh) | Baixa | Usuário bloqueado pode renovar sessão via refresh |
| [SEC-010](#sec-010--login-não-rejeita-usuário-bloqueado) | Baixa | Login não rejeita usuário bloqueado |
| [SEC-011](#sec-011--ui-participante-não-revalida-bloqueio-antes-do-submit) | Baixa | UI participante não revalida bloqueio antes do submit |
| [SEC-012](#sec-012--painel-admin-de-especiais-permite-salvar-após-finalizar) | Baixa | Painel admin de especiais permite salvar após finalizar |
| [SEC-013](#sec-013--leitura-de-marcadores-sem-mesmo-gate-de-feature-do-post) | Informativa | Leitura de marcadores sem mesmo gate de feature do POST |
| [SEC-014](#sec-014--admin-da-empresa-participa-do-bolão) | Informativa | Admin da empresa participa do bolão |
| [SEC-015](#sec-015--bloqueio-de-especiais-usa-calendário-global-como-fallback) | Informativa | Bloqueio de especiais usa calendário global como fallback |

---

## Achados detalhados

### SEC-001 — Owner altera resultado após jogo finalizado

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Alta |
| **Arquivos** | `app/routes/jogos.py` (`patch_jogo_resultado`), `app/services/jogo_service.py` (`patch_resultado`) |
| **Impacto** | Placar, pênaltis ou classificado podem mudar depois do jogo encerrado; `pontuacao_service.recalcular_todos_palpites_do_jogo` reescreve pontos de todos os participantes. |
| **Evidência** | `patch_resultado` persiste campos e recalcula sem checar `jogo.finalizado` (aprox. linhas 319–349 de `jogo_service.py`). `patch_finalizar` só impede nova finalização, não protege edições posteriores. |
| **Correção** | Recusar `PATCH .../resultado` (e opcionalmente marcadores oficiais) quando `jogo.finalizado`; ou fluxo explícito de reabertura com auditoria e recálculo controlado. |
| **Testes** | `PATCH /jogos/{id}/resultado` com jogo `finalizado=true` → 409; regressão em `tests/test_pontuacao_recalc.py` conforme política desejada. |

### SEC-002 — Owner altera agenda de jogo sem trava pós-finalização

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Alta |
| **Arquivos** | `app/routes/jogos.py` (`put_jogo`), `app/services/jogo_service.py` (`update_jogo`) |
| **Impacto** | Mudança de `data_jogo`, rodada ou países altera `momento_fim_edicao_palpite` e pode reabrir ou fechar palpites de forma retroativa. |
| **Evidência** | `update_jogo` valida fase/países, mas não `jogo.finalizado` (aprox. 260–311). |
| **Correção** | Bloquear PUT em jogo finalizado; para correções, endpoint dedicado com impacto documentado no ranking. |
| **Testes** | `PUT /jogos/{id}` com `data_jogo` futuro em jogo finalizado → 409; palpite após mudança de agenda não deve contornar prazo já vencido sem revalidação no commit. |

### SEC-003 — Owner desfinaliza resultado especial via PUT

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Alta |
| **Arquivos** | `app/routes/resultados_especiais.py`, `app/services/resultado_especial_service.py` (`atualizar`), `app/schemas/resultado_especial.py` |
| **Impacto** | `finalizado: false` zera pontuação de especiais (`pontuacao_service` ignora resultado não finalizado). |
| **Evidência** | `row.finalizado = data.finalizado` no PUT (aprox. 63–85 de `resultado_especial_service.py`); `PATCH /finalizar` só define `True`. |
| **Correção** | Ignorar ou rejeitar `finalizado` no PUT; imutabilidade após `finalizar`. |
| **Testes** | `PUT /resultados-especiais` com `finalizado: false` após finalizar → 400; pontos de especiais permanecem. |

### SEC-004 — Recálculo retroativo de pontuação por mudança de regras

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Média |
| **Arquivos** | `app/routes/configuracao_bolao.py`, `app/routes/pontuacao_fase.py`, `app/services/pontuacao_service.py` |
| **Impacto** | Admin altera pesos com jogos já finalizados e ranking histórico muda sem trava de “competição encerrada”. |
| **Evidência** | `put_configuracao_bolao` e `put_pontuacao_fase` chamam `recalcular_pontuacao_empresa` após salvar. |
| **Correção** | Versionar regras, congelar pontos por rodada, ou exigir confirmação/owner com auditoria. |
| **Testes** | Alterar `pontos_placar_exato` com jogos finalizados: assert política (bloqueio ou recálculo auditado). |

### SEC-005 — Bloqueio de palpites especiais ignorado sem `empresa_id`

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Média |
| **Arquivos** | `app/services/palpite_especial_service.py` (`_assert_nao_bloqueado`), `app/auth/dependencies.py` (`require_participante_bolao`) |
| **Impacto** | Participante sem vínculo de empresa não passa por `palpites_especiais_esta_bloqueado`. |
| **Evidência** | `_assert_nao_bloqueado` retorna cedo se `empresa_id is None` (aprox. 33–37). Escrita usa `user.empresa_id` da rota sem exigir não-nulo. |
| **Correção** | Exigir `empresa_id` em `require_participante_bolao` ou falhar fechado no bloqueio (fail-closed). |
| **Testes** | Participante sem empresa + bloqueio ativo → 403 em POST/PUT `/palpites-especiais/me`. |

### SEC-006 — Flag `bloqueado` em palpite especial não aplicada na escrita

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Média |
| **Arquivos** | `app/models/palpite_especial.py`, `app/services/palpite_especial_service.py` (`create_palpite`, `update_palpite_me`, `to_read`) |
| **Impacto** | Coluna `bloqueado` e bloqueio efetivo na leitura não impedem POST/PUT se alguém manipular API ou dado legado no banco. |
| **Evidência** | `to_read` calcula `bloqueado` efetivo; `create`/`update` só chamam `_assert_nao_bloqueado` por data de config. |
| **Correção** | Checar `p.bloqueado` e bloqueio efetivo antes do `commit`. |
| **Testes** | Registro com `bloqueado=True` no DB → PUT 400. |

### SEC-007 — Janela TOCTOU no prazo de palpites e marcadores

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Média |
| **Arquivos** | `app/services/palpite_jogo_service.py` (`_assert_palpite_aberto`), `app/services/marcador_brasil_service.py` (`_assert_jogo_editavel_marcadores_usuario`) |
| **Impacto** | Duas requisições iniciadas antes do limite podem persistir após o prazo; não há constraint temporal no PostgreSQL/SQLite. |
| **Evidência** | Checagem de relógio antes do `commit`, sem `SELECT FOR UPDATE` ou revalidação no flush. |
| **Correção** | Revalidar no `commit`; lock pessimista no `Jogo`; ou coluna `palpite_fechado_em` derivada no servidor. |
| **Testes** | Corrida com relógio mockado na fronteira do prazo (palpite e marcadores). |

### SEC-008 — Marcadores oficiais sem validação contra placar do Brasil

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Média |
| **Arquivos** | `app/services/marcador_brasil_service.py` (`sincronizar_marcadores_resultado_admin`) |
| **Impacto** | Owner pode lançar marcadores incompatíveis com gols do Brasil no resultado oficial e distorcer bônus. |
| **Evidência** | Sincronização substitui linhas e recalcula sem comparar soma ao placar (aprox. 161–179). Participante tem validação em `_gols_brasil_no_palpite`. |
| **Correção** | Validar soma de marcadores vs gols BR no placar oficial; opcionalmente exigir jogo finalizado. |
| **Testes** | POST resultado marcadores com soma > gols BR → 400. |

### SEC-009 — Usuário bloqueado pode renovar sessão via refresh

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Baixa |
| **Arquivos** | `app/services/auth_service.py` (`refresh_access_token`), `app/auth/dependencies.py` (`get_current_active_user`) |
| **Impacto** | Após `PATCH /equipe/{id}/bloquear`, refresh válido ainda emite access token; apostas novas falham em rotas com `get_current_active_user`. |
| **Evidência** | Refresh checa `ativo`, não `bloqueado` (aprox. 95–100). |
| **Correção** | Checar `bloqueado` no refresh; revogar refresh tokens ao bloquear. |
| **Testes** | Bloquear usuário com sessão ativa → `POST /auth/refresh` → 403. |

### SEC-010 — Login não rejeita usuário bloqueado

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Baixa |
| **Arquivos** | `app/services/auth_service.py` (`login`) |
| **Impacto** | Novo login com credenciais corretas em conta bloqueada ainda emite tokens. |
| **Evidência** | `login` valida `ativo`, não `bloqueado` (aprox. 44–57). |
| **Correção** | `403` se `user.bloqueado`. |
| **Testes** | Login com usuário bloqueado → 403. |

### SEC-011 — UI participante não revalida bloqueio antes do submit

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Baixa (UX / defesa em profundidade) |
| **Arquivos** | `frontend/src/pages/JogosPage.tsx`, `frontend/src/components/GameCard/index.tsx`, `frontend/src/lib/utils.ts` (`jogoBloqueado`), `frontend/src/pages/EspeciaisPage.tsx` |
| **Impacto** | Cliente pode chamar API fora do prazo com UI desatualizada; servidor deve rejeitar (não é bypass confirmado). |
| **Evidência** | `handleSave` / marcadores sem revalidação local obrigatória; especiais dependem de `palpite?.bloqueado` sem config local quando `/me` é null. |
| **Correção** | Guard no handler; mensagem clara em 400; opcional campo “editável até” da API. |
| **Testes** | E2E: tela aberta além do prazo → submit → erro; unitários de `jogoBloqueado`. |

### SEC-012 — Painel admin de especiais permite salvar após finalizar

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Baixa (governança owner) |
| **Arquivos** | `frontend/src/features/admin/specials/AdminSpecials.tsx` |
| **Impacto** | UI não espelha imutabilidade; API aceita PUT (SEC-003). |
| **Evidência** | “Finalizar especiais” desabilita só o botão de finalizar; “Salvar resultado” permanece ativo. |
| **Correção** | Modo somente leitura após `finalizado`; alinhar com backend. |
| **Testes** | E2E admin após finalizar; API PUT bloqueado. |

### SEC-013 — Leitura de marcadores sem mesmo gate de feature do POST

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Informativa |
| **Arquivos** | `app/routes/marcadores_brasil.py` (`get_marcadores_me_jogo` vs `post_marcadores_jogo`) |
| **Impacto** | `GET /marcadores-brasil/me/{jogo_id}` usa `require_primeiro_login_concluido`; escrita exige participante + `exigir_marcadores_brasil_habilitado_empresa`. |
| **Evidência** | Listagem chama `listar_marcadores_palpite_usuario` com checagem de feature dentro do service no POST, não necessariamente igual no GET. |
| **Correção** | Alinhar dependências se a regra for “sem feature, sem acesso”. |
| **Testes** | GET com empresa sem bônus BR → 403 consistente com POST. |

### SEC-014 — Admin da empresa participa do bolão

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Informativa (política de produto) |
| **Arquivos** | `app/auth/dependencies.py` (`require_participante_bolao`), `frontend/src/features/auth/AuthContext.tsx` |
| **Impacto** | `tipo_usuario=admin` pode apostar; não é falha técnica de bypass. |
| **Evidência** | Só `owner` é barrado na dependência. |
| **Correção** | Documentar ou restringir papel admin a gestão. |
| **Testes** | Política explícita em `tests/test_permissions.py`. |

### SEC-015 — Bloqueio de especiais usa calendário global como fallback

| Campo | Detalhe |
|-------|---------|
| **Gravidade** | Informativa |
| **Arquivos** | `app/services/configuracao_bolao_service.py` (`get_data_bloqueio_palpites_especiais_efetiva`) |
| **Impacto** | Sem data na empresa, usa `min(Jogo.data_jogo)` da rodada 1 global; agenda do owner afeta tenants sem data própria. |
| **Evidência** | Fallback em consulta global de `Jogo` (aprox. 105–114). |
| **Correção** | Exigir data por empresa ou documentar dependência do calendário global. |
| **Testes** | `tests/test_regra_prazo_especiais.py`; cenário multi-empresa. |

---

## Front-end (defesa em profundidade)

| Fluxo | UI bloqueia? | API participante | Risco bypass direto |
|-------|----------------|------------------|---------------------|
| Palpite por jogo | Parcial (`jogoBloqueado`) | Rejeita prazo / finalizado | Baixo |
| Marcadores BR (usuário) | Parcial | Rejeita | Baixo |
| Especiais | Parcial sem `/me` | Rejeita bloqueio (ressalva SEC-005) | Baixo–médio |
| Resultado oficial 2h | Sim (owner) | Rejeita antes de 2h | Baixo |
| Pós-finalização owner | Parcial | **Permitido** (SEC-001–003) | N/A (privilégio owner) |

Relógio do cliente em `frontend/src/lib/utils.ts` pode divergir do UTC do servidor (`_agora_utc` nos services) — reforça SEC-007 e SEC-011.

---

## Controles já existentes

- Ownership de palpites: `get_by_id_for_usuario` / `get_por_usuario` em `palpite_jogo_service` e `palpite_especial_service`.
- Prazo alinhado a `momento_fim_edicao_palpite` (1h antes do primeiro jogo da rodada/fase ou do próprio jogo).
- Finalização de jogo: +2h após início, placar e mata-mata validados em `patch_finalizar`.
- Unicidade: `uq_palpite_usuario_jogo`, `uq_palpite_especial_usuario`.
- Data de bloqueio de especiais imutável após primeira definição (`atualizar_configuracao_empresa`).
- Owner isolado de rotas de participante via `require_participante_bolao`.
- Cobertura parcial: `tests/test_bloqueios.py`, `tests/test_permissions.py`, `tests/test_regra_prazo_especiais.py`, `tests/test_limites_payload.py`, `tests/test_pontuacao_recalc.py`.

---

## Lacunas de teste recomendadas

1. IDOR: `PUT /palpites-jogos/{id}` com palpite de outro usuário → 404.
2. Owner pós-finalização: resultado e `PUT /jogos/{id}` (SEC-001, SEC-002).
3. PUT de resultado especial com `finalizado: false` (SEC-003).
4. Participante sem `empresa_id` vs bloqueio de especiais (SEC-005).
5. `palpites_especiais.bloqueado` persistido vs API de escrita (SEC-006).
6. Corrida no limite de prazo (SEC-007).
7. Admin alterando pontos com jogos finalizados (SEC-004).
8. Bloqueio de equipe vs login/refresh (SEC-009, SEC-010).
9. Marcadores oficiais vs placar BR (SEC-008).
10. `PUT /marcadores-brasil/{id}` após prazo (espelhar palpites em `test_bloqueios.py`).

---

## Referências de código

- Autorização: `app/auth/dependencies.py`
- Palpites jogo: `app/routes/palpites_jogos.py`, `app/services/palpite_jogo_service.py`
- Jogos / resultados: `app/routes/jogos.py`, `app/services/jogo_service.py`
- Especiais: `app/routes/palpites_especiais.py`, `app/services/palpite_especial_service.py`
- Resultado especial oficial: `app/routes/resultados_especiais.py`, `app/services/resultado_especial_service.py`
- Configuração e bloqueios: `app/routes/configuracao_bolao.py`, `app/services/configuracao_bolao_service.py`
- Marcadores Brasil: `app/routes/marcadores_brasil.py`, `app/services/marcador_brasil_service.py`
- Sessão: `app/services/auth_service.py`
- UI jogos: `frontend/src/pages/JogosPage.tsx`, `frontend/src/components/GameCard/`
- UI especiais: `frontend/src/pages/EspeciaisPage.tsx`, `frontend/src/features/admin/specials/AdminSpecials.tsx`
