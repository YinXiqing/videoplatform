import logging
import os
from logging.handlers import RotatingFileHandler
import structlog
from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


def _add_request_id(_, __, event_dict):
    rid = request_id_ctx.get()
    if rid:
        event_dict["request_id"] = rid
    return event_dict


def setup_logging(sql: bool = False):
    use_json = os.environ.get("LOG_JSON", "").lower() in ("1", "true")
    renderer = structlog.processors.JSONRenderer() if use_json else structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            _add_request_id,
            renderer,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
    )

    # 根 logger：控制台 + 可选文件持久化
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    log_file = os.environ.get("LOG_FILE", "")
    if log_file:
        fh = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8",
        )
        fh.setFormatter(logging.Formatter("%(message)s"))
        root.addHandler(fh)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "alembic"):
        logging.getLogger(name).setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.DEBUG if sql else logging.WARNING
    )


logger = structlog.get_logger()
