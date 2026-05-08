from __future__ import annotations

from datetime import UTC, datetime

from app.database import SessionLocal
from app.schemas.jogo import JogoCreate
from app.services import configuracao_bolao_service, jogo_service
from tests.factories import seed_admin_e_usuario, seed_dois_paises


def test_bloqueio_especiais_usa_primeiro_jogo_da_rodada_1_grupos() -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)

        # Jogo de mata-mata mais cedo NÃO deve definir o bloqueio dos especiais.
        jogo_service.create_jogo(
            db,
            JogoCreate(
                fase="oitavas",
                grupo=None,
                tipo_fase="mata_mata",
                pais_casa_id=a,
                pais_fora_id=b,
                data_jogo=datetime(2030, 6, 1, 10, 0, tzinfo=UTC),
            ),
        )

        # Primeira rodada de grupos define o bloqueio de especiais.
        jogo_grupo = jogo_service.create_jogo(
            db,
            JogoCreate(
                fase="Grupo A - Rodada 1",
                grupo="A",
                tipo_fase="grupos",
                rodada=1,
                pais_casa_id=b,
                pais_fora_id=a,
                data_jogo=datetime(2030, 6, 5, 18, 0, tzinfo=UTC),
            ),
        )

        ts = configuracao_bolao_service.get_data_bloqueio_palpites_especiais_efetiva(db)
        assert ts is not None
        assert ts == jogo_grupo.data_jogo
    finally:
        db.close()
