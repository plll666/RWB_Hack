"""Подключение к PostgreSQL для Streamlit-дашборда.

Правила из плана финала:
- значение берётся из переменной окружения DATABASE_URL, если она задана;
- без неё применяется локальная учебная база из README (контейнер `hack_postgres`);
- SQL выполняется только параметрами, сборка запроса конкатенацией значений запрещена;
- соединение закрывается после каждого запроса.
"""

import os

import pandas as pd
import psycopg2

# Порядок попыток подключения: сначала окружение, затем типовые порты этой
# учебной базы. Первое удачное запоминаем на время сессии приложения.
DEFAULT_DSN_CANDIDATES = [
    "postgresql://hack:hack@localhost:5433/marketplace",  # hack_postgres (порт 5433)
    "postgresql://hack:hack@localhost:5432/marketplace",  # docker-compose по умолчанию
]

_active_dsn: str | None = None


def resolve_dsn() -> str:
    """Вернуть рабочий DSN: DATABASE_URL, затем кандидаты по умолчанию."""
    global _active_dsn
    if _active_dsn:
        return _active_dsn

    from_env = os.environ.get("DATABASE_URL")
    candidates = ([from_env] if from_env else []) + DEFAULT_DSN_CANDIDATES
    last_error: Exception | None = None

    for dsn in candidates:
        try:
            probe = psycopg2.connect(dsn, connect_timeout=3)
            probe.close()
            _active_dsn = dsn
            return dsn
        except psycopg2.OperationalError as exc:  # порт/база недоступны — пробуем следующий
            last_error = exc

    raise ConnectionError(
        "Не удалось подключиться к PostgreSQL (проверены: "
        + ", ".join(dsn.split("@")[-1] for dsn in candidates)
        + f"). Последняя ошибка: {last_error}"
    )


def _connect() -> psycopg2.extensions.connection:
    return psycopg2.connect(resolve_dsn(), connect_timeout=10)


def fetch_df(query: str, params: tuple | list | None = None) -> pd.DataFrame:
    """Выполнить параметризованный SELECT и вернуть DataFrame."""
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        return pd.DataFrame(rows, columns=columns)
    finally:
        conn.close()


def fetch_scalar(query: str, params: tuple | list | None = None):
    """Выполнить запрос и вернуть одно значение (первая колонка первой строки)."""
    df = fetch_df(query, params)
    if df.empty:
        return None
    return df.iloc[0, 0]


def describe_active_dsn() -> str:
    """Адрес, к которому подключились, — для строки отладки в интерфейсе."""
    return _active_dsn or "(нет подключения)"
