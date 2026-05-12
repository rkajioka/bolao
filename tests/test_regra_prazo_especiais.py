from __future__ import annotations

from datetime import UTC, datetime

from app.database import SessionLocal
from app.schemas.jogo import JogoCreate
from app.services import configuracao_bolao_service, jogo_service
from tests.factories import seed_admin_e_usuario, seed_dois_paises, seed_empresa


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

        from app.services import usuario_service

        user = usuario_service.get_by_email(db, "user-etapa13@example.com")
        assert user is not None and user.empresa_id is not None
        ts = configuracao_bolao_service.get_data_bloqueio_palpites_especiais_efetiva(
            db, user.empresa_id
        )
        assert ts is not None
        assert ts == jogo_grupo.data_jogo
    finally:
        db.close()


def test_bloqueio_especiais_por_empresa_sem_data_usa_calendario_global() -> None:
    db = SessionLocal()
    try:
        seed_admin_e_usuario(db)
        a, b = seed_dois_paises(db)
        empresa_a = seed_empresa(db, "EMP_A")
        empresa_b = seed_empresa(db, "EMP_B")
        data_empresa_a = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)
        cfg_a = configuracao_bolao_service.ensure_configuracao_empresa(db, empresa_a.id)
        cfg_a.data_bloqueio_palpites_especiais = data_empresa_a
        db.commit()
        configuracao_bolao_service.ensure_configuracao_empresa(db, empresa_b.id)

        jogo_global = jogo_service.create_jogo(
            db,
            JogoCreate(
                fase="Grupo B - Rodada 1",
                grupo="B",
                tipo_fase="grupos",
                rodada=1,
                pais_casa_id=a,
                pais_fora_id=b,
                data_jogo=datetime(2030, 6, 10, 15, 0, tzinfo=UTC),
            ),
        )

        ts_a = configuracao_bolao_service.get_data_bloqueio_palpites_especiais_efetiva(
            db, empresa_a.id
        )
        ts_b = configuracao_bolao_service.get_data_bloqueio_palpites_especiais_efetiva(
            db, empresa_b.id
        )
        assert ts_a is not None and ts_b is not None
        assert ts_a.replace(tzinfo=UTC) == data_empresa_a
        assert ts_b.replace(tzinfo=UTC) == jogo_global.data_jogo.replace(tzinfo=UTC)
    finally:
        db.close()
