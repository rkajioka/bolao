from collections.abc import Generator
from urllib.parse import parse_qs, unquote, urlparse

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings

settings = get_settings()


def _build_creator(fallback_url: str, aws_secret_name: str | None, aws_region: str, aws_rds_secret_arn: str | None = None):
    """Retorna função creator para o SQLAlchemy engine.

    Busca a DATABASE_URL com TTL cache curto quando Secrets Manager está configurado,
    permitindo que rotações automáticas de senha do RDS sejam absorvidas sem reiniciar.
    """
    import psycopg2

    def _current_url() -> str:
        if aws_rds_secret_arn:
            from app.core.aws_secrets import get_rds_credentials
            creds = get_rds_credentials(aws_rds_secret_arn, aws_region)
            if creds:
                username, password = creds
                parsed = urlparse(fallback_url.replace("postgresql+psycopg2://", "postgresql://", 1))
                return (
                    f"postgresql+psycopg2://{username}:{quote_plus(password)}"
                    f"@{parsed.hostname}:{parsed.port or 5432}{parsed.path}?sslmode=require"
                )
        if aws_secret_name:
            from app.core.aws_secrets import get_current_database_url
            fresh = get_current_database_url(aws_secret_name, aws_region)
            if fresh:
                return fresh
        return fallback_url

    def creator():
        url = _current_url()
        clean = url.replace("postgresql+psycopg2://", "postgresql://", 1)
        parsed = urlparse(clean)

        params: dict = {
            "host": parsed.hostname,
            "port": parsed.port or 5432,
            "dbname": parsed.path.lstrip("/"),
            "user": parsed.username,
            "password": unquote(parsed.password or ""),
        }
        if parsed.query:
            for k, v_list in parse_qs(parsed.query).items():
                params[k] = v_list[0]

        return psycopg2.connect(**params)

    return creator


if ":memory:" in settings.database_url:
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(
        settings.database_url,
        creator=_build_creator(settings.database_url, settings.aws_secret_name, settings.aws_region, settings.aws_rds_secret_arn),
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_pool_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_recycle=settings.db_pool_recycle,
    )

    if settings.aws_rds_secret_arn or settings.aws_secret_name:
        @event.listens_for(engine, "handle_error")
        def _on_db_error(ctx):
            msg = str(getattr(ctx.original_exception, "pgerror", "") or ctx.original_exception).lower()
            if "password authentication failed" in msg or "authentication failed" in msg:
                if settings.aws_rds_secret_arn:
                    from app.core.aws_secrets import invalidate_rds_credentials_cache
                    invalidate_rds_credentials_cache()
                else:
                    from app.core.aws_secrets import invalidate_database_url_cache
                    invalidate_database_url_cache()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
