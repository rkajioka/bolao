"""
Seed opcional: insere as seleções por grupo (conforme lista do bolão) se a sigla ainda não existir.

Bandeiras: usa URLs do serviço público flagcdn (apenas para facilitar o MVP).
Você pode trocar depois por arquivos em /static/bandeiras/ (ex.: http://localhost:8000/static/bandeiras/br.png).

Uso:
  python scripts/seed_paises_grupos.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.schemas.pais import PaisCreate
from app.services import pais_service

# (nome exibido, sigla única no bolão, grupo, código minúsculo para flagcdn.com)
SELECOES: list[tuple[str, str, str, str]] = [
    ("México", "MX", "A", "mx"),
    ("África do Sul", "ZA", "A", "za"),
    ("Coreia do Sul", "KR", "A", "kr"),
    ("República Tcheca", "CZ", "A", "cz"),
    ("Canadá", "CA", "B", "ca"),
    ("Bósnia e Herzegovina", "BA", "B", "ba"),
    ("Catar", "QA", "B", "qa"),
    ("Suíça", "CH", "B", "ch"),
    ("Brasil", "BR", "C", "br"),
    ("Marrocos", "MA", "C", "ma"),
    ("Haiti", "HT", "C", "ht"),
    ("Escócia", "SCO", "C", "gb-sct"),
    ("Estados Unidos", "US", "D", "us"),
    ("Paraguai", "PY", "D", "py"),
    ("Austrália", "AU", "D", "au"),
    ("Turquia", "TR", "D", "tr"),
    ("Alemanha", "DE", "E", "de"),
    ("Curaçao", "CW", "E", "cw"),
    ("Costa do Marfim", "CI", "E", "ci"),
    ("Equador", "EC", "E", "ec"),
    ("Holanda", "NL", "F", "nl"),
    ("Japão", "JP", "F", "jp"),
    ("Suécia", "SE", "F", "se"),
    ("Tunísia", "TN", "F", "tn"),
    ("Bélgica", "BE", "G", "be"),
    ("Egito", "EG", "G", "eg"),
    ("Irã", "IR", "G", "ir"),
    ("Nova Zelândia", "NZ", "G", "nz"),
    ("Espanha", "ES", "H", "es"),
    ("Cabo Verde", "CV", "H", "cv"),
    ("Arábia Saudita", "SA", "H", "sa"),
    ("Uruguai", "UY", "H", "uy"),
    ("França", "FR", "I", "fr"),
    ("Senegal", "SN", "I", "sn"),
    ("Iraque", "IQ", "I", "iq"),
    ("Noruega", "NO", "I", "no"),
    ("Argentina", "AR", "J", "ar"),
    ("Argélia", "DZ", "J", "dz"),
    ("Áustria", "AT", "J", "at"),
    ("Jordânia", "JO", "J", "jo"),
    ("Portugal", "PT", "K", "pt"),
    ("RD Congo", "CD", "K", "cd"),
    ("Uzbequistão", "UZ", "K", "uz"),
    ("Colômbia", "CO", "K", "co"),
    ("Inglaterra", "ENG", "L", "gb-eng"),
    ("Croácia", "HR", "L", "hr"),
    ("Gana", "GH", "L", "gh"),
    ("Panamá", "PA", "L", "pa"),
]


def main() -> None:
    db: Session = SessionLocal()
    criados = 0
    try:
        for nome, sigla, grupo, slug in SELECOES:
            if pais_service.get_by_sigla(db, sigla) is not None:
                continue
            url = f"https://flagcdn.com/w40/{slug}.png"
            pais_service.create_pais(
                db,
                PaisCreate(
                    nome=nome,
                    sigla=sigla,
                    bandeira_url=url,
                    grupo=grupo,
                ),
            )
            criados += 1
        print(f"Inseridos {criados} países (demais já existiam por sigla).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
