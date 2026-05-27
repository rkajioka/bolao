# CLAUDE.md — Bolão da Copa

Guia de referência rápida para Claude Code e desenvolvedores novos no projeto.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | FastAPI + SQLAlchemy + PostgreSQL |
| Auth | PyJWT (HS256) + refresh token em cookie HttpOnly |
| Frontend | React + Vite (em `frontend/`) |
| Deploy | EC2 + Nginx + uvicorn (systemd) |
| E-mail | Microsoft Graph (Outlook) via httpx |
| Cache/Rate-limit | Redis |
| Secrets | AWS Secrets Manager (`AWS_SECRET_NAME`) |

---

## Comandos comuns

```bash
# Rodar localmente
uvicorn app.main:app --reload

# Rodar testes
pytest -q

# Migrations
alembic upgrade head          # aplica
alembic revision --autogenerate -m "descricao"  # gera

# Auditar CVEs
python -m pip_audit -r requirements.txt

# Build frontend
cd frontend && npm install && npm run build
```

---

## Checklist de deploy (produção)

Antes de cada deploy em `main`, confirme:

- [ ] `DEBUG=false` no ambiente de produção
- [ ] `JWT_SECRET` é um segredo forte (`openssl rand -hex 32`) — **nunca** o placeholder padrão
- [ ] `JWT_REFRESH_COOKIE_SECURE=true` (obrigatório quando `PUBLIC_APP_URL` usa HTTPS)
- [ ] `JWT_REFRESH_COOKIE_SAMESITE=strict`
- [ ] `DATABASE_URL` aponta para o banco de produção
- [ ] `AWS_SECRET_NAME` configurado (ou todas as variáveis sensíveis no ambiente)
- [ ] `REDIS_URL` apontando para Redis de produção
- [ ] `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `OUTLOOK_SENDER` setados
- [ ] `PUBLIC_APP_URL` com HTTPS (ex.: `https://bolao.empresa.com`)
- [ ] `CORS_ALLOWED_ORIGINS` com domínios exatos (sem trailing slash)
- [ ] `TRUSTED_PROXY=true` se houver proxy reverso (Nginx) na frente
- [ ] Nginx configurado com gzip e headers de segurança (`nginx.conf` na raiz)
- [ ] `alembic upgrade head` executado após deploy
- [ ] Serviço reiniciado: `sudo systemctl restart bolao`
- [ ] Health check OK: `curl https://<dominio>/health`

---

## Rotação de `JWT_SECRET`

> ⚠️ Trocar o segredo **desloga todos os usuários** imediatamente.

### Procedimento

1. **Janela de manutenção** — comunique a interrupção ou planeje fora do horário de pico.
2. **Gere novo segredo:**
   ```bash
   openssl rand -hex 32
   ```
3. **Atualize o secret** no AWS Secrets Manager (ou variável de ambiente do servidor).
4. **Rolling restart** — reinicie workers um a um para minimizar downtime:
   ```bash
   sudo systemctl restart bolao
   ```
   > Durante o rolling restart: tokens antigos podem receber 401 em workers novos.
   > Use manutenção completa se zero-downtime for crítico.
5. **Verifique os logs** — confirme inicialização sem erros de JWT:
   ```bash
   journalctl -u bolao -n 50 --no-pager
   ```
6. **Invalide refresh tokens antigos** (opcional, mas recomendado):
   ```sql
   UPDATE refresh_token SET revogado = TRUE WHERE revogado = FALSE;
   ```

### Por que isso acontece
O JWT é stateless — cada worker verifica a assinatura localmente com `JWT_SECRET`.
Não há como invalidar um token sem trocar o segredo ou manter blocklist centralizada.
O refresh token é rastreado em banco (pode ser revogado individualmente),
mas o access token (curta duração) depende apenas da assinatura.

---

## Variáveis de ambiente obrigatórias em produção

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql+psycopg2://user:pass@host/db` |
| `JWT_SECRET` | Segredo HMAC-HS256 (≥ 32 bytes hex) | `openssl rand -hex 32` |
| `PUBLIC_APP_URL` | URL pública do frontend (com HTTPS) | `https://bolao.empresa.com` |
| `JWT_REFRESH_COOKIE_SECURE` | Cookie Secure (obrigatório com HTTPS) | `true` |
| `REDIS_URL` | URL do Redis para rate-limit | `redis://localhost:6379/0` |
| `AWS_SECRET_NAME` | Nome do secret no AWS SM | `bolao/production` |
| `AZURE_CLIENT_ID` | App registration Microsoft | — |
| `AZURE_CLIENT_SECRET` | Client secret do app | — |
| `AZURE_TENANT_ID` | Tenant ID Azure AD | — |
| `OUTLOOK_SENDER` | E-mail remetente autorizado | `bolao@empresa.com` |

---

## Segurança — notas rápidas

- **PyJWT com `algorithms=["HS256"]`** — algoritmo fixo em `app/auth/jwt.py`; rejeita `none` e troca de algoritmo.
- **Logs de e-mail** — endereços mascarados (`jo***@empresa.com`) em `email_service.py`.
- **Empresa_id do owner** — sempre validado contra o banco em `dependencies.py` (`_assert_empresa_exists`).
- **CVE aberto**: `starlette` (PYSEC-2026-161) — aguardando compatibilidade com fastapi para fazer upgrade.
  Monitorar: `python -m pip_audit -r requirements.txt`

---

## Estrutura resumida

```
app/
  auth/           # JWT, dependências de autenticação
  core/           # Configurações, AWS Secrets
  models/         # SQLAlchemy ORM
  routes/         # FastAPI routers (um por domínio)
  schemas/        # Pydantic request/response
  services/       # Lógica de negócio
  database.py     # Engine + pool SQLAlchemy
  main.py         # App factory, CORS, routers
frontend/         # React + Vite
nginx.conf        # Configuração Nginx (gzip, TLS, proxy)
alembic/          # Migrations
requirements.txt  # Dependências Python (pinadas)
RUNBOOK.md        # Operações críticas (JWT, pool, locks)
SECURITY.md       # Análise de segurança detalhada
```

---

## Pool de banco de dados

Configurado em `app/database.py`:

| Parâmetro | Valor | Motivo |
|---|---|---|
| `pool_size` | 5 | Conexões permanentes |
| `max_overflow` | 5 | Pico: até 10 conexões totais |
| `pool_timeout` | 10s | Espera máxima por conexão |
| `pool_recycle` | 1800s | Evita timeout idle do PostgreSQL |
| `pool_pre_ping` | True | Evita "connection closed" silencioso |
