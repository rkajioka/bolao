# Runbook — Operações Críticas

> Este documento descreve procedimentos que exigem atenção especial em produção.
> Atualizar sempre que novas dependências operacionais forem identificadas.

---

## Rotação de `JWT_SECRET` (Sprint 2.10)

**Impacto**: A variável `JWT_SECRET` assina **todos** os access tokens e refresh tokens em
circulação. Ao trocar o segredo, todos os tokens emitidos com o valor anterior se tornam
inválidos imediatamente — **todos os usuários serão deslogados**.

### Procedimento seguro (rolling restart)

1. **Planeje uma janela de manutenção** ou comunique a interrupção de sessão aos usuários.
2. **Atualize o secret** na fonte de verdade (ex.: secret manager do provedor de nuvem /
   variável de ambiente do servidor).
3. **Faça restart rolling** de todos os workers uvicorn:
   - Se usar vários processos/containers, reinicie um a um para não derrubar todos
     simultaneamente. Workers novos usarão o novo segredo; workers antigos rejeitarão
     tokens com o novo segredo, mas ainda aceitam os antigos até serem trocados.
   - **Janela de incoerência**: durante o rolling restart, usuários cujos tokens foram
     emitidos pelo worker antigo podem receber 401 no worker novo (e vice-versa).
     Recomenda-se a janela de manutenção para evitar isso.
4. **Verifique** nos logs que os workers iniciaram sem erros de JWT.
5. **Invalide refresh tokens antigos** via script SQL se necessário:
   ```sql
   UPDATE refresh_token SET revogado = TRUE WHERE revogado = FALSE;
   ```
   Isso força todos os usuários a fazer login novamente com o novo segredo.

### Causa raiz da limitação
O JWT é stateless — o segredo é verificado localmente em cada worker sem consultar o banco.
Não há como "invalidar" um token individualmente sem revogar o segredo inteiro ou manter
uma blocklist centralizada (ex.: Redis). O design atual usa refresh tokens rastreados em
banco de dados como segundo fator de revogação para refresh, mas o access token (de curta
duração) é verificado apenas pela assinatura JWT.

---

## Configuração de pool SQLAlchemy (Sprint 2.6)

O pool está configurado em `app/database.py` com:
- `pool_size=5` — conexões mantidas abertas permanentemente
- `max_overflow=5` — conexões extras sob pico (total max 10)
- `pool_timeout=10` — espera máxima por conexão disponível (segundos)
- `pool_recycle=1800` — reciclagem de conexões idle a cada 30 min (evita timeout do PG)
- `pool_pre_ping=True` — testa conexões antes de usar (evita "connection closed" silencioso)

Para monitorar lock waits em PostgreSQL, habilite:
```sql
-- postgresql.conf ou ALTER SYSTEM
log_lock_waits = on
deadlock_timeout = '200ms'
```

---

## Diagnóstico de race conditions (SELECT FOR UPDATE)

Para confirmar que os locks estão sendo aplicados:

```sql
-- Visualizar locks ativos
SELECT pid, relation::regclass, mode, granted
FROM pg_locks
WHERE NOT granted;

-- Sessões bloqueadas
SELECT wait_event_type, wait_event, query, pid
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```

Os endpoints com `SELECT FOR UPDATE` são:
- `POST /auth/ativar-conta` → lock no `Convite` antes de criar o `Usuario`
- `POST /auth/redefinir-senha` → lock no `PasswordReset` antes de marcar como usado
