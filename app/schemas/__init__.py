from app.schemas.configuracao_bolao import ConfiguracaoBolaoBase, ConfiguracaoBolaoRead
from app.schemas.jogo import JogoBase, JogoCreate, JogoRead
from app.schemas.marcador_brasil import (
    MarcadorBrasilPalpiteBase,
    MarcadorBrasilPalpiteRead,
    MarcadorBrasilResultadoBase,
    MarcadorBrasilResultadoRead,
)
from app.schemas.pais import PaisBase, PaisCreate, PaisRead
from app.schemas.palpite_especial import PalpiteEspecialBase, PalpiteEspecialCreate, PalpiteEspecialRead
from app.schemas.palpite_jogo import PalpiteJogoBase, PalpiteJogoCreate, PalpiteJogoRead
from app.schemas.resultado_especial import ResultadoEspecialBase, ResultadoEspecialRead, ResultadoEspecialWrite
from app.schemas.usuario import UsuarioBase, UsuarioCreate, UsuarioRead

__all__ = [
    "UsuarioBase",
    "UsuarioCreate",
    "UsuarioRead",
    "PaisBase",
    "PaisCreate",
    "PaisRead",
    "JogoBase",
    "JogoCreate",
    "JogoRead",
    "PalpiteJogoBase",
    "PalpiteJogoCreate",
    "PalpiteJogoRead",
    "PalpiteEspecialBase",
    "PalpiteEspecialCreate",
    "PalpiteEspecialRead",
    "ResultadoEspecialBase",
    "ResultadoEspecialWrite",
    "ResultadoEspecialRead",
    "MarcadorBrasilPalpiteBase",
    "MarcadorBrasilPalpiteRead",
    "MarcadorBrasilResultadoBase",
    "MarcadorBrasilResultadoRead",
    "ConfiguracaoBolaoBase",
    "ConfiguracaoBolaoRead",
]
