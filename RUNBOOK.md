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

## Nginx — API na raiz e rotas duplas (SPA + FastAPI)

O frontend chama a API em `/auth`, `/equipe`, `/ranking`, etc. (sem prefixo `/api/`).
O arquivo [`nginx.conf`](nginx.conf) na raiz do repositório é a referência para produção.

### Por que isso importa

Se o Nginx entregar `index.html` para chamadas de API da equipe, a tela mostra **0 membros**
mesmo com usuários no banco. O frontend usa **`/api/equipe`** (location `/api/` → sempre FastAPI);
a rota React continua em `/equipe` (SPA). Após deploy do `nginx.conf` atualizado: `sudo nginx -t && sudo systemctl reload nginx`.

### Ao adicionar um novo router FastAPI

1. Confira o `prefix` em `app/routes/*.py`.
2. Se **não** existir página React no mesmo path → adicione o prefixo na regex **só-API** em `nginx.conf`.
3. Se existir página React no mesmo path (como `/equipe`) → adicione na regex **rotas duplas** e em `frontend/vite.config.ts` (`SPA_HTML_EXACT_PATHS` + `apiProxy`).
4. No servidor: `sudo nginx -t && sudo systemctl reload nginx`.

### Deploy da config no EC2

```bash
# 1. Backup
sudo cp /etc/nginx/sites-available/bolao /etc/nginx/sites-available/bolao.bak.$(date +%F)

# 2. Copiar nginx.conf do repositório para o path usado na instância
sudo cp /caminho/do/repo/nginx.conf /etc/nginx/sites-available/bolao

# 3. Validar e aplicar
sudo nginx -t
sudo systemctl reload nginx

# 4. Backend atrás do proxy (IP real nos logs)
# Confirme TRUSTED_PROXY=true no .env do serviço bolao
grep TRUSTED_PROXY /caminho/do/.env
```

### Verificação pós-deploy

```bash
# Health
curl -s https://SEU_DOMINIO/health
# Esperado: {"status":"ok"}

# API Equipe (substitua o token)
curl -s -D - -o /tmp/equipe.json \
  -H "Accept: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  "https://SEU_DOMINIO/equipe?empresa_id=2"
# Esperado no header: Content-Type: application/json
# Esperado no corpo: array JSON (não HTML)
```

No navegador (DevTools → Rede, **Desativar cache**):

- `equipe?empresa_id=…` → `Content-Type: application/json`, corpo com membros/convites.
- F5 em `/equipe` → página React continua carregando (HTML).

### Sintomas de config incorreta

| Sintoma | Causa provável |
|---------|----------------|
| Equipe com 0 membros, DB ok | `/equipe` retornando HTML da SPA |
| 502 Bad Gateway | gunicorn/uvicorn não está em `127.0.0.1:8000` |
| Login ok, dados vazios | Prefixo de API faltando no `nginx.conf` |

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

---

## Deploy EC2 (GitHub Actions + SSH)

Constantes de produção (devem coincidir com `deploy.yml` e `bolao.service`):

| Constante | Valor |
|-----------|-------|
| `APP_DIR` | `/var/www/bolao` |
| `VENV_DIR` | `/var/www/bolao/.venv` |
| `PYTHON` | `/var/www/bolao/.venv/bin/python` |
| `GUNICORN` | `/var/www/bolao/.venv/bin/gunicorn` |

O deploy automático roda em push em `main` (`.github/workflows/deploy.yml`). Após alterar `bolao.service` no servidor:

```bash
sudo cp /var/www/bolao/bolao.service /etc/systemd/system/bolao.service
sudo systemctl daemon-reload
sudo systemctl restart bolao
```

### Descoberta (antes de debugar deploy)

Conectar com o usuário do secret `EC2_USER` e rodar:

```bash
set -euo pipefail
echo "=== Systemd ==="
systemctl cat bolao | grep -E '^(WorkingDirectory|ExecStart|EnvironmentFile|User)='
echo "=== Venv ==="
/var/www/bolao/.venv/bin/python -c "import sys; print('OK', sys.executable)" \
  || echo "RESULTADO: VENV_QUEBRADO"
echo "=== npm (shell não interativo, igual ao CI) ==="
bash -lc 'command -v npm; npm -v' || echo "RESULTADO: NPM_AUSENTE_NO_SSH_NAO_INTERATIVO"
```

### Recuperação manual (site fora ou venv quebrado)

```bash
APP_DIR=/var/www/bolao
set -euo pipefail
cd "$APP_DIR"
rm -rf .venv
python3 -m venv .venv
"$APP_DIR/.venv/bin/pip" install -r requirements.txt
bash -lc 'command -v npm'   # deve existir; senão instalar Node (abaixo)
( cd "$APP_DIR/frontend" && npm ci && npm run build )
"$APP_DIR/.venv/bin/python" -m alembic upgrade head
sudo systemctl restart bolao
curl -sf "https://SEU_DOMINIO/health" | grep -q '"status":"ok"' && echo PASS || echo FAIL
```

### Node ausente no SSH não interativo

O GitHub Actions não carrega `.bashrc`. Teste: `bash -lc 'command -v npm'`. Se falhar:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
bash -lc 'node -v && npm -v'
```

### Validação pós-deploy

```bash
curl -sf https://SEU_DOMINIO/health
sudo systemctl is-active bolao
journalctl -u bolao -n 50 --no-pager
test -f /var/www/bolao/frontend/dist/index.html && echo "dist OK"
```
