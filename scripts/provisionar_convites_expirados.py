"""
Provisiona convites expirados com senha temporária padrão (backlog one-shot).

Uso (com venv ativo e DATABASE_URL no ambiente ou .env):
  python scripts/provisionar_convites_expirados.py              # dry-run (padrão)
  python scripts/provisionar_convites_expirados.py --apply        # executa
  python scripts/provisionar_convites_expirados.py --apply --empresa-id 2
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import distinct, select

from app.database import SessionLocal
from app.models.convite import Convite
from app.services import convite_provision_service


def _empresa_ids_alvo(db, empresa_id: int | None) -> list[int]:
    if empresa_id is not None:
        return [empresa_id]
    rows = db.scalars(
        select(distinct(Convite.empresa_id)).where(Convite.empresa_id.is_not(None))
    ).all()
    return sorted(int(e) for e in rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Provisiona convites expirados com senha padrão Bolao123!."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica alterações no banco (sem esta flag, apenas simula).",
    )
    parser.add_argument(
        "--empresa-id",
        type=int,
        default=None,
        help="Limita o processamento a uma empresa.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    erros = 0
    total = 0
    provisionados = 0
    try:
        empresa_ids = _empresa_ids_alvo(db, args.empresa_id)
        if not empresa_ids:
            print("Nenhuma empresa encontrada.")
            return

        modo = "APPLY" if args.apply else "DRY-RUN"
        print(f"[{modo}] Processando convites expirados elegíveis.\n")

        for emp_id in empresa_ids:
            resultado = convite_provision_service.provisionar_convites_expirados_lote(
                db,
                emp_id,
                solicitante_id=None,
                ip=None,
                origem="script",
                dry_run=not args.apply,
            )
            total += resultado.total
            provisionados += resultado.provisionados
            erros += resultado.erros
            for item in resultado.itens:
                prefix = f"[empresa={emp_id}] {item.email}"
                if item.status == "simulado":
                    print(f"SKIP(dry-run) {prefix} — {item.detalhe}")
                elif item.status == "ok":
                    print(f"OK {prefix} — {item.detalhe}")
                else:
                    print(f"ERRO {prefix} — {item.detalhe}")

        if total == 0:
            print("Nenhum convite expirado elegível encontrado.")
            return
    finally:
        db.close()

    print(f"\nResumo: {provisionados}/{total} provisionado(s), {erros} erro(s).")
    if erros:
        sys.exit(1)
    print("Concluído sem erros.")


if __name__ == "__main__":
    main()
