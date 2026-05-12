"""Regras compartilhadas de palpites e resultados especiais."""


def validar_podio_sem_pais_repetido(
    *,
    campeao_id: int | None,
    vice_campeao_id: int | None,
    terceiro_lugar_id: int | None,
) -> None:
    ids = [x for x in (campeao_id, vice_campeao_id, terceiro_lugar_id) if x is not None]
    if len(ids) != len(set(ids)):
        raise ValueError(
            "Campeão, vice-campeão e 3º lugar devem ser seleções de países distintos"
        )
