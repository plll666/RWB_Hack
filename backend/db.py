"""Подключение к PostgreSQL для FastAPI-бэкенда дашборда.

Правила из плана финала:
- значение берётся из переменной окружения DATABASE_URL, если она задана;
- без неё применяется локальная учебная база из README (контейнер `hack_postgres`);
- SQL выполняется только параметрами, сборка запроса конкатенацией значений запрещена;
- соединение закрывается после каждого запроса.

Файл повторяет контракт dashboard/db.py — единый слой данных для обоих вариантов
приложения (Streamlit устарел, остаётся как резерв для защиты).
"""

import os

import pandas as pd
import psycopg2
from psycopg2.pool import ThreadedConnectionPool

DEFAULT_DSN_CANDIDATES = [
    "postgresql://hack:hack@localhost:5433/marketplace",  # hack_postgres (порт 5433)
    "postgresql://hack:hack@localhost:5432/marketplace",  # docker-compose по умолчанию
]

_pool: ThreadedConnectionPool | None = None
_active_dsn: str | None = None


def init_pool() -> ThreadedConnectionPool:
    """Создать пул соединений: сначала DATABASE_URL, затем кандидаты по умолчанию.

    Пул нужен, потому что FastAPI может обслуживать запросы параллельно.
    """
    global _pool, _active_dsn

    if _pool is not None:
        return _pool

    from_env = os.environ.get("DATABASE_URL")
    candidates = ([from_env] if from_env else []) + DEFAULT_DSN_CANDIDATES
    last_error: Exception | None = None

    for dsn in candidates:
        try:
            probe = psycopg2.connect(dsn, connect_timeout=3)
            probe.close()
            _active_dsn = dsn
            break
        except psycopg2.OperationalError as exc:  # порт/база недоступны — пробуем следующий
            last_error = exc
    else:
        raise ConnectionError(
            "Не удалось подключиться к PostgreSQL (проверены: "
            + ", ".join(dsn.split("@")[-1] for dsn in candidates)
            + f"). Последняя ошибка: {last_error}"
        )

    # 1..8 соединений: для дашборда избыток не нужен.
    _pool = ThreadedConnectionPool(minconn=1, maxconn=8, dsn=_active_dsn, connect_timeout=10)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


def fetch_df(query: str, params: tuple | list | None = None) -> pd.DataFrame:
    """Параметризованный SELECT в DataFrame. Бесконечные пароля не собираем."""
    pool = init_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        conn.commit()
        return pd.DataFrame(rows, columns=columns)
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def describe_active_dsn() -> str:
    """Адрес, к которому подключились, — для строки отладки в интерфейсе."""
    return _active_dsn or "(нет подключения)"
