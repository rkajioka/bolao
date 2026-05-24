"""
Utilitário para criar ou atualizar o secret do Bolão no AWS Secrets Manager.

Uso:
    # Criar ou atualizar interativamente:
    python scripts/setup_aws_secret.py

    # Especificar nome e região:
    python scripts/setup_aws_secret.py --secret-name bolao/production --region sa-east-1

    # Apenas mostrar o JSON que seria enviado (sem alterar nada no AWS):
    python scripts/setup_aws_secret.py --dry-run

Campos gerenciados (sensíveis):
    DATABASE_URL, JWT_SECRET,
    AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID,
    OUTLOOK_SENDER, REDIS_URL

O script lê os valores atuais do seu .env (ou ambiente) como sugestão,
mas você pode sobrescrever cada um interativamente.

Pré-requisitos:
    pip install boto3
    aws configure  (ou credenciais via IAM role / env vars)

Política IAM mínima necessária para o servidor de produção:
    {
        "Effect": "Allow",
        "Action": [
            "secretsmanager:GetSecretValue"
        ],
        "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:<secret-name>-*"
    }

Para criar/atualizar o secret (apenas durante o setup), adicione também:
    secretsmanager:CreateSecret
    secretsmanager:PutSecretValue
    secretsmanager:DescribeSecret
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sys


MANAGED_FIELDS: list[tuple[str, str]] = [
    ("DATABASE_URL",        "URL completa de conexão com o banco (inclui usuário e senha)"),
    ("JWT_SECRET",          "Segredo JWT — gere com: openssl rand -hex 32"),
    ("AZURE_CLIENT_ID",     "Client ID do app registration no Azure (para envio de e-mail)"),
    ("AZURE_CLIENT_SECRET", "Client Secret do app registration no Azure"),
    ("AZURE_TENANT_ID",     "Tenant ID do Azure AD"),
    ("OUTLOOK_SENDER",      "E-mail remetente do Outlook / Microsoft 365"),
    ("REDIS_URL",           "URL do Redis para rate limit distribuído (deixe em branco para pular)"),
]


def _current_value(key: str) -> str:
    """Retorna o valor atual da variável de ambiente (ou string vazia)."""
    return os.environ.get(key, "")


def _prompt(label: str, hint: str, current: str, *, secret: bool = False) -> str:
    display_current = ("********" if (secret and current) else current) or "(vazio)"
    prompt_text = f"  {label}\n  {hint}\n  Atual: {display_current}\n  Novo valor (Enter para manter): "
    if secret:
        value = getpass.getpass(prompt_text)
    else:
        value = input(prompt_text)
    return value.strip() if value.strip() else current


def collect_values(interactive: bool) -> dict[str, str]:
    payload: dict[str, str] = {}

    for key, description in MANAGED_FIELDS:
        current = _current_value(key)
        is_secret = any(w in key.lower() for w in ("secret", "password", "url"))

        if interactive:
            print()
            value = _prompt(key, description, current, secret=is_secret)
        else:
            value = current

        if value:
            payload[key] = value
        elif key in ("DATABASE_URL", "JWT_SECRET"):
            print(f"AVISO: {key} está vazio — obrigatório para produção.", file=sys.stderr)

    return payload


def upsert_secret(secret_name: str, region: str, payload: dict[str, str]) -> None:
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        print("Erro: boto3 não está instalado. Execute: pip install boto3", file=sys.stderr)
        sys.exit(1)

    client = boto3.client("secretsmanager", region_name=region)
    secret_string = json.dumps(payload, ensure_ascii=False)

    try:
        client.describe_secret(SecretId=secret_name)
        # Secret já existe — atualiza
        client.put_secret_value(SecretId=secret_name, SecretString=secret_string)
        print(f"\n✅ Secret '{secret_name}' atualizado na região '{region}'.")
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ResourceNotFoundException":
            # Secret não existe — cria
            client.create_secret(
                Name=secret_name,
                Description="Credenciais do Bolão Copa do Mundo",
                SecretString=secret_string,
            )
            print(f"\n✅ Secret '{secret_name}' criado na região '{region}'.")
        else:
            print(f"\nErro ao acessar o AWS Secrets Manager: {exc}", file=sys.stderr)
            sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cria ou atualiza o secret do Bolão no AWS Secrets Manager."
    )
    parser.add_argument(
        "--secret-name",
        default="bolao/production",
        help="Nome do secret no AWS (padrão: bolao/production)",
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", "us-east-1"),
        help="Região AWS (padrão: us-east-1 ou AWS_REGION do ambiente)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Apenas exibe o JSON que seria enviado, sem alterar nada no AWS",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Usa somente as variáveis de ambiente atuais, sem prompts",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  Bolão Copa — AWS Secrets Manager Setup")
    print("=" * 60)
    print(f"\n  Secret name : {args.secret_name}")
    print(f"  Region      : {args.region}")
    if args.dry_run:
        print("  Modo        : DRY-RUN (nenhuma alteração será feita)\n")

    payload = collect_values(interactive=not args.non_interactive and not args.dry_run)

    print("\n--- JSON que será gravado no secret ---")
    # Mascara valores para não exibir segredos no terminal
    masked = {
        k: ("********" if any(w in k.lower() for w in ("secret", "password")) else v)
        for k, v in payload.items()
    }
    print(json.dumps(masked, indent=2, ensure_ascii=False))
    print("---------------------------------------")

    if args.dry_run:
        print("\nDry-run: nenhuma alteração foi feita.")
        return

    confirm = input("\nConfirmar gravação no AWS? [s/N] ").strip().lower()
    if confirm not in ("s", "sim", "y", "yes"):
        print("Operação cancelada.")
        sys.exit(0)

    upsert_secret(args.secret_name, args.region, payload)

    print("\nPróximos passos:")
    print(f"  1. Defina no ambiente de produção:")
    print(f"       AWS_SECRET_NAME={args.secret_name}")
    print(f"       AWS_REGION={args.region}")
    print(f"  2. Remova DATABASE_URL, JWT_SECRET e demais credenciais do .env de produção.")
    print(f"  3. Garanta que a role IAM do servidor tem permissão secretsmanager:GetSecretValue")
    print(f"     no ARN deste secret.")


if __name__ == "__main__":
    main()
