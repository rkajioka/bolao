"""
Seed opcional: insere a primeira linha de `configuracoes_bolao` se a tabela estiver vazia.

Valores são defaults de MVP (ajustáveis depois via CRUD admin quando existir).
Execute na raiz do projeto com DATABASE_URL definido:
`python scripts/seed_configuracao_bolao.py`
"""

from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.configuracao_bolao import ConfiguracaoBolao  # noqa: E402


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Defina DATABASE_URL")
        sys.exit(1)
    engine = create_engine(url, future=True)
    with Session(engine) as db:
        if db.scalar(select(ConfiguracaoBolao).limit(1)) is not None:
            print("configuracoes_bolao já possui registro; nada a fazer.")
            return
        db.add(
            ConfiguracaoBolao(
                data_bloqueio_palpites_especiais=None,
                pontos_campeao=25,
                pontos_melhor_jogador=10,
                pontos_artilheiro=10,
                pontos_melhor_goleiro=10,
                pontos_placar_exato=18,
                pontos_resultado_correto=10,
                pontos_classificado_mata_mata=12,
                pontos_marcador_brasil=4,
                pontos_marcador_brasil_com_quantidade=4,
            )
        )
        db.commit()
        print("Configuração padrão do bolão inserida.")


if __name__ == "__main__":
    main()
