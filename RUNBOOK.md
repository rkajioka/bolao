# Runbook — Operações Críticas

> Este documento descreve procedimentos que exigem atenção especial em produção.
> Atualizar sempre que novas dependências operacionais forem identificadas.

---

## Capacidade e tuning de workers

### Modelo de concorrência

O backend usa **gunicorn + uvicorn workers** (ver `bolao.service`). Cada worker é um
processo Python independente, com seu próprio pool de conexões ao banco. As rotas são
síncronas (`def`), portanto FastAPI as executa num thread pool por worker (padrão: 40
threads/worker via anyio).

```
Requisições simultâneas max ≈ WEB_CONCURRENCY × 40 (threads/worker)
Conexões DB max             = WEB_CONCURRENCY × (DB_POOL_SIZE + DB_POOL_MAX_OVERFLOW)
```

### Tabela de calibragem por instância

| EC2         | vCPUs | RAM   | WEB_CONCURRENCY | DB_POOL_SIZE | Conexões DB max | Usuários simultâneos¹ |
|-------------|-------|-------|-----------------|--------------|-----------------|----------------------|
| t3.small    | 2     | 2 GB  | **3**           | 5            | 30              | ~80                  |
| t3.medium   | 2     | 4 GB  | **5**           | 5            | 50              | ~150                 |
| t3.large    | 2     | 8 GB  | **5**           | 8            | 80              | ~200                 |
| t3.xlarge   | 4     | 16 GB | **9**           | 8            | 144             | ~400                 |

¹ Usuários *simultâneos* estimados com tempo médio de requisição de 80 ms.

> **PostgreSQL `max_connections`**: padrão é 100. Se o total de conexões DB calculado
> acima se aproximar desse limite, aumente via:
> ```sql
> ALTER SYSTEM SET max_connections = 200;
> -- requer restart do PostgreSQL
> ```

### Ajustar workers sem redeploy de código

Edite o `.env` da instância:
```bash
WEB_CONCURRENCY=5
DB_POOL_SIZE=5
DB_POOL_MAX_OVERFLOW=5
```
Depois: `sudo systemctl restart bolao`

### Diagnóstico de saturação

```bash
# Ver workers ativos e consumo
sudo systemctl status bolao

# Quantas conexões ao banco estão abertas agora
sudo -u postgres psql -c "
  SELECT count(*), state
  FROM pg_stat_activity
  WHERE datname = 'bolao_copa'
  GROUP BY state;"

# Pool_timeout estourando? Busca por QueuePool timeout nos logs
journalctl -u bolao --since "1 hour ago" | grep -i "QueuePool\|timeout\|pool"
```

### Quando escalar verticalmente

Sinais de que precisa de mais workers ou instância maior:
- `pool_timeout` aparecendo nos logs (fila de DB cheia)
- Latência p95 > 500 ms no ranking durante jogos
- `systemctl status bolao` mostrando workers em restart loop

### Plano de crescimento futuro

Se o bolão crescer para milhares de usuários simultâneos, o próximo passo é
**SQLAlchemy assíncrono** (troca `psycopg2` por `asyncpg`, rotas `def` → `async def`).
Isso elimina o thread pool por worker e permite centenas de requests concorrentes por
processo. É uma refatoração relevante mas compatível com a estrutura atual de services.

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

## Configuração de pool SQLAlchemy

O pool é configurado via variáveis de ambiente em `app/core/config.py` e aplicado em
`app/database.py`. Padrões:

| Variável               | Padrão | Descrição                                         |
|------------------------|--------|---------------------------------------------------|
| `DB_POOL_SIZE`         | 5      | Conexões permanentes por worker                   |
| `DB_POOL_MAX_OVERFLOW` | 5      | Conexões extras sob pico (total = size + overflow) |
| `DB_POOL_TIMEOUT`      | 10     | Segundos de espera por conexão disponível         |
| `DB_POOL_RECYCLE`      | 1800   | Recicla conexões ociosas a cada 30 min            |
| `pool_pre_ping`        | True   | Testa conexão antes de usar (sempre ativo)        |

**Total de conexões ao PostgreSQL** = `WEB_CONCURRENCY × (DB_POOL_SIZE + DB_POOL_MAX_OVERFLOW)`

Com 3 workers e defaults: **3 × 10 = 30 conexões** (seguro para PG padrão de 100).

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
