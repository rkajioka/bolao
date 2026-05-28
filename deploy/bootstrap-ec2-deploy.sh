#!/usr/bin/env bash
# Configuracao unica no EC2 para o deploy via GitHub Actions (sessao SSH interativa).
# Uso: bash /var/www/bolao/deploy/bootstrap-ec2-deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bolao}"
DEPLOY_USER="$(whoami)"
SUDOERS_SRC="$APP_DIR/deploy/sudoers-bolao-deploy"
SUDOERS_DST="/etc/sudoers.d/bolao-deploy"
SYSTEMCTL="$(command -v systemctl)"

echo "==> Usuario de deploy: $DEPLOY_USER"
echo "==> APP_DIR: $APP_DIR"

if [ ! -d "$APP_DIR" ]; then
  echo "FALHA: $APP_DIR nao existe"
  exit 1
fi

if [ ! -f "$SUDOERS_SRC" ]; then
  echo "FALHA: $SUDOERS_SRC nao encontrado."
  echo "  sudo chown -R $DEPLOY_USER:$DEPLOY_USER $APP_DIR"
  echo "  git config --global --add safe.directory $APP_DIR"
  echo "  cd $APP_DIR && git pull origin main"
  exit 1
fi

echo "==> Ajustando dono do repositorio (sudo com senha, se pedir)..."
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

echo "==> Instalando sudoers de deploy..."
sudo cp "$SUDOERS_SRC" "$SUDOERS_DST"
# Troca TODAS as ocorrencias de ubuntu (inclui Defaults:ubuntu e chown user:group)
sudo sed -i "s/ubuntu/$DEPLOY_USER/g" "$SUDOERS_DST"
sudo chmod 440 "$SUDOERS_DST"
sudo visudo -cf "$SUDOERS_DST"

echo "==> Testando NOPASSWD (igual ao CI)..."
sudo -n "$SYSTEMCTL" daemon-reload
echo "NOPASSWD OK (systemctl daemon-reload)"

if sudo -n chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR" 2>/dev/null; then
  echo "NOPASSWD OK (chown)"
else
  echo "AVISO: chown NOPASSWD falhou; dono ja foi ajustado com sudo acima."
fi

echo ""
echo "Pronto. Rode o workflow de deploy no GitHub."
