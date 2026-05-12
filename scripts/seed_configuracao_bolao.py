"""
Seed opcional: insere a primeira linha de `configuracoes_bolao` se a tabela estiver vazia.

Valores são defaults de MVP (ajustáveis depois via CRUD admin quando existir).
Execute na raiz do projeto com DATABASE_URL definido:
`py scripts/seed_configuracao_bolao.py --empresa-id 1`
"""

from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import get_settings  # noqa: E402
from app.models.configuracao_bolao import ConfiguracaoBolao  # noqa: E402
from app.models.empresa import Empresa  # noqa: E402


def _resolve_empresa_id(db: Session, empresa_id: int | None) -> int:
    if empresa_id is not None:
        empresa = db.get(Empresa, empresa_id)
        if empresa is None:
            raise SystemExit(f"Empresa id={empresa_id} não encontrada.")
        return empresa.id
    first = db.scalar(select(Empresa.id).order_by(Empresa.id).limit(1))
    if first is None:
        raise SystemExit("Nenhuma empresa cadastrada; informe --empresa-id após criar uma empresa.")
    return int(first)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed da configuração padrão do bolão por empresa.")
    parser.add_argument(
        "--empresa-id",
        type=int,
        default=None,
        help="ID da empresa (default: primeira empresa existente).",
    )
    args = parser.parse_args()

    url = get_settings().database_url
    engine = create_engine(url, future=True)
    with Session(engine) as db:
        empresa_id = _resolve_empresa_id(db, args.empresa_id)
        if db.scalar(select(ConfiguracaoBolao).where(ConfiguracaoBolao.empresa_id == empresa_id).limit(1)) is not None:
            print(f"configuracoes_bolao já possui registro para empresa_id={empresa_id}; nada a fazer.")
            return
        db.add(
            ConfiguracaoBolao(
                empresa_id=empresa_id,
                data_bloqueio_palpites_especiais=None,
                pontos_campeao=25,
                pontos_vice_campeao=20,
                pontos_terceiro_lugar=15,
                pontos_artilheiro_pais=10,
                pontos_placar_exato=18,
                pontos_resultado_correto=10,
                pontos_classificado_mata_mata=12,
                pontos_marcador_brasil=4,
                pontos_marcador_brasil_com_quantidade=4,
            )
        )
        db.commit()
        print(f"Configuração padrão do bolão inserida para empresa_id={empresa_id}.")


if __name__ == "__main__":
    main()
