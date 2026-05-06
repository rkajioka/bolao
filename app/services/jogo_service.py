"""
Regras de jogos — fase de grupos e mata-mata (cadastro, edição, resultado, finalizar).

Recálculo de pontuação dos palpites após resultado/finalizar: Etapa 10 (`pontuacao_service`);
aqui apenas persistimos dados e validamos regras do MD.
"""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.jogo import Jogo
from app.schemas.jogo import JogoCreate, JogoResultadoPatch, JogoUpdate
from app.services import pais_service


def _jogo_list_loaders():
    return (
        joinedload(Jogo.pais_casa),
        joinedload(Jogo.pais_fora),
        joinedload(Jogo.classificado),
    )


def get_by_id(db: Session, jogo_id: int) -> Jogo | None:
    return db.scalar(
        select(Jogo)
        .options(*_jogo_list_loaders())
        .where(Jogo.id == jogo_id)
    )


def list_jogos(db: Session) -> list[Jogo]:
    q = (
        select(Jogo)
        .options(*_jogo_list_loaders())
        .order_by(Jogo.data_jogo.asc(), Jogo.id.asc())
    )
    return list(db.scalars(q).unique().all())


def list_jogos_cronologico(db: Session) -> list[Jogo]:
    return list_jogos(db)


def list_jogos_mata_mata(db: Session) -> list[Jogo]:
    q = (
        select(Jogo)
        .options(*_jogo_list_loaders())
        .where(Jogo.tipo_fase == "mata_mata")
        .order_by(Jogo.data_jogo.asc(), Jogo.id.asc())
    )
    return list(db.scalars(q).unique().all())


def list_jogos_brasil(db: Session) -> list[Jogo]:
    br = pais_service.get_by_sigla(db, "BR")
    if br is None:
        return []
    q = (
        select(Jogo)
        .options(*_jogo_list_loaders())
        .where(or_(Jogo.pais_casa_id == br.id, Jogo.pais_fora_id == br.id))
        .order_by(Jogo.data_jogo.asc(), Jogo.id.asc())
    )
    return list(db.scalars(q).unique().all())


def list_jogos_por_grupo(db: Session) -> list[tuple[str, list[Jogo]]]:
    q = (
        select(Jogo)
        .options(*_jogo_list_loaders())
        .where(Jogo.tipo_fase == "grupos")
        .where(Jogo.grupo.isnot(None))
        .order_by(Jogo.grupo.asc(), Jogo.data_jogo.asc(), Jogo.id.asc())
    )
    rows = list(db.scalars(q).unique().all())
    por_grupo: dict[str, list[Jogo]] = defaultdict(list)
    for j in rows:
        g = (j.grupo or "").strip().upper()
        if g:
            por_grupo[g].append(j)
    return sorted(por_grupo.items(), key=lambda x: x[0])


def _assert_paises_existem(db: Session, casa_id: int, fora_id: int) -> None:
    if pais_service.get_by_id(db, casa_id) is None or pais_service.get_by_id(db, fora_id) is None:
        raise ValueError("País da casa ou país de fora não encontrado")


def _validar_regras_fase_grupos(
    *,
    tipo_fase: str,
    grupo: str | None,
    pais_casa_id: int,
    pais_fora_id: int,
) -> None:
    if tipo_fase != "grupos":
        raise ValueError("Combinação inválida: esperado tipo_fase=grupos")
    if not grupo or not str(grupo).strip():
        raise ValueError("Grupo é obrigatório para a fase de grupos")
    if pais_casa_id == pais_fora_id:
        raise ValueError("País da casa e país de fora devem ser diferentes")


def _validar_regras_mata_mata(
    *,
    tipo_fase: str,
    grupo: str | None,
    pais_casa_id: int,
    pais_fora_id: int,
) -> None:
    if tipo_fase != "mata_mata":
        raise ValueError("Combinação inválida: esperado tipo_fase=mata_mata")
    if grupo is not None and str(grupo).strip():
        raise ValueError("Jogos do mata-mata não devem ter grupo (use null ou omita)")
    if pais_casa_id == pais_fora_id:
        raise ValueError("País da casa e país de fora devem ser diferentes")


def create_jogo(db: Session, data: JogoCreate) -> Jogo:
    _assert_paises_existem(db, data.pais_casa_id, data.pais_fora_id)

    if data.tipo_fase == "grupos":
        _validar_regras_fase_grupos(
            tipo_fase=data.tipo_fase,
            grupo=data.grupo,
            pais_casa_id=data.pais_casa_id,
            pais_fora_id=data.pais_fora_id,
        )
        grupo_db = str(data.grupo).strip().upper()
        tipo_db = "grupos"
    else:
        _validar_regras_mata_mata(
            tipo_fase=data.tipo_fase,
            grupo=data.grupo,
            pais_casa_id=data.pais_casa_id,
            pais_fora_id=data.pais_fora_id,
        )
        grupo_db = None
        tipo_db = "mata_mata"

    j = Jogo(
        fase=data.fase.strip(),
        grupo=grupo_db,
        tipo_fase=tipo_db,
        pais_casa_id=data.pais_casa_id,
        pais_fora_id=data.pais_fora_id,
        data_jogo=data.data_jogo,
    )
    db.add(j)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(j)
    return get_by_id(db, j.id)  # type: ignore[return-value]


def _bloqueia_mudanca_de_fase(jogo: Jogo, novo_tipo: str | None) -> None:
    if novo_tipo is None or novo_tipo == jogo.tipo_fase:
        return
    raise ValueError("Não é permitido alterar tipo_fase entre grupos e mata-mata")


def update_jogo(db: Session, jogo: Jogo, data: JogoUpdate) -> Jogo:
    if data.tipo_fase is not None:
        _bloqueia_mudanca_de_fase(jogo, data.tipo_fase)

    tipo = jogo.tipo_fase
    grupo = data.grupo if data.grupo is not None else jogo.grupo
    casa = data.pais_casa_id if data.pais_casa_id is not None else jogo.pais_casa_id
    fora = data.pais_fora_id if data.pais_fora_id is not None else jogo.pais_fora_id

    if tipo == "grupos":
        _validar_regras_fase_grupos(tipo_fase=tipo, grupo=grupo, pais_casa_id=casa, pais_fora_id=fora)
    else:
        _validar_regras_mata_mata(tipo_fase=tipo, grupo=grupo, pais_casa_id=casa, pais_fora_id=fora)

    _assert_paises_existem(db, casa, fora)

    if data.fase is not None:
        jogo.fase = data.fase.strip()
    if data.grupo is not None:
        if jogo.tipo_fase == "mata_mata":
            jogo.grupo = None
        else:
            jogo.grupo = str(data.grupo).strip().upper() if data.grupo.strip() else None
    if data.pais_casa_id is not None:
        jogo.pais_casa_id = data.pais_casa_id
    if data.pais_fora_id is not None:
        jogo.pais_fora_id = data.pais_fora_id
    if data.data_jogo is not None:
        jogo.data_jogo = data.data_jogo

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(jogo)
    return get_by_id(db, jogo.id)  # type: ignore[return-value]


def _assert_classificado_participa(jogo: Jogo, classificado_id: int) -> None:
    if classificado_id not in (jogo.pais_casa_id, jogo.pais_fora_id):
        raise ValueError("O classificado deve ser o país da casa ou o país de fora deste jogo")


def patch_resultado(db: Session, jogo: Jogo, data: JogoResultadoPatch) -> Jogo:
    if data.placar_casa is not None:
        jogo.placar_casa = data.placar_casa
    if data.placar_fora is not None:
        jogo.placar_fora = data.placar_fora
    if data.teve_prorrogacao is not None:
        jogo.teve_prorrogacao = data.teve_prorrogacao
    if data.foi_para_penaltis is not None:
        jogo.foi_para_penaltis = data.foi_para_penaltis
    if data.penaltis_casa is not None:
        jogo.penaltis_casa = data.penaltis_casa
    if data.penaltis_fora is not None:
        jogo.penaltis_fora = data.penaltis_fora
    if data.classificado_id is not None:
        if jogo.tipo_fase != "mata_mata":
            raise ValueError("classificado_id só se aplica a jogos de mata-mata")
        if pais_service.get_by_id(db, data.classificado_id) is None:
            raise ValueError("classificado_id não encontrado")
        _assert_classificado_participa(jogo, data.classificado_id)
        jogo.classificado_id = data.classificado_id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(jogo)
    return get_by_id(db, jogo.id)  # type: ignore[return-value]


def patch_finalizar(db: Session, jogo: Jogo) -> Jogo:
    if jogo.finalizado:
        raise ValueError("Jogo já está finalizado")

    if jogo.tipo_fase == "mata_mata":
        if jogo.classificado_id is None:
            raise ValueError("Informe quem se classificou antes de finalizar o jogo de mata-mata")
        _assert_classificado_participa(jogo, jogo.classificado_id)
    if jogo.placar_casa is None or jogo.placar_fora is None:
        raise ValueError("Informe placar da casa e placar de fora antes de finalizar")

    if jogo.foi_para_penaltis:
        if jogo.penaltis_casa is None or jogo.penaltis_fora is None:
            raise ValueError("Informe placar dos pênaltis quando o jogo foi para pênaltis")

    jogo.finalizado = True
    db.commit()
    db.refresh(jogo)
    # Etapa 10: recalcular_pontuacao_palpites_jogo(jogo.id)
    return get_by_id(db, jogo.id)  # type: ignore[return-value]


def jogo_envolve_brasil(db: Session, jogo: Jogo) -> bool:
    """True se um dos times for o Brasil (sigla BR no cadastro de países)."""
    br = pais_service.get_by_sigla(db, "BR")
    if br is None:
        return False
    return jogo.pais_casa_id == br.id or jogo.pais_fora_id == br.id
