"""Professional logging setup for SmartPark."""

import logging
import logging.config
from pathlib import Path

from app.config.settings import Settings


def configure_logging(settings: Settings) -> None:
    """Configure root logging using dictConfig for consistency."""
    log_level = settings.LOG_LEVEL
    log_path = Path('logs')
    log_path.mkdir(parents=True, exist_ok=True)

    formatter = {
        'text': {
            'format': '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'json': {
            # Lightweight JSON-like format without adding external dependency.
            'format': '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    }

    selected_formatter = 'json' if settings.LOG_FORMAT == 'json' else 'text'

    logging.config.dictConfig(
        {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': formatter,
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'formatter': selected_formatter,
                    'level': log_level,
                },
                'file': {
                    'class': 'logging.handlers.RotatingFileHandler',
                    'formatter': selected_formatter,
                    'filename': str(log_path / 'app.log'),
                    'maxBytes': 5 * 1024 * 1024,
                    'backupCount': 5,
                    'level': log_level,
                    'encoding': 'utf-8',
                },
            },
            'root': {
                'handlers': ['console', 'file'],
                'level': log_level,
            },
        }
    )


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger instance."""
    return logging.getLogger(name)
