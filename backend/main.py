"""FastAPI-бэкенд дашборда: только core/mart, параметры, никакого SQL-склейки.

Запуск из корня репозитория:
    uvicorn backend.main:app --reload --port 8000

Эндпоинты:
    GET /api/health        — статус соединения с БД
    GET /api/meta          — границы периода и список штатов (для фильтров)
    GET /api/overview      — KPI, помесячная динамика, статусы
    GET /api/delivery      — сроки/опоздания, штаты (порог 500), оценки
    GET /api/categories    — сводка категорий и продавцов + опции фильтра
    GET /api/product       — карточка и история цен товара (вопрос 6)
    GET /api/quality       — диагностика качества данных
"""

from __future__ import annotations

import datetime as dt

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg2.errors import OperationalError, ProgrammingError

from backend import db, queries

app = FastAPI(
    title="Olist Dashboard API",
    description="Слой данных дашборда: обращения только к core/mart.",
    version="1.0.0",
)


async def db_error_handler(_request, exc: Exception):
    """Ошибки SQL/подключения не маскируются: клиент получает текст с инструкцией."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "База недоступна или модель не собрана. Выполните последовательность"
                " из README: setup.sh → build.sql → mart.sql → checks.sql."
                f" Детали: {exc}"
            )
        },
    )


for _exc_class in (OperationalError, ProgrammingError, ConnectionError):
    app.add_exception_handler(_exc_class, db_error_handler)

# React-девсервер Vite (5173) и собранная версия (4173).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _parse_date(value: str, name: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"Некорректная дата в {name}: {value!r}"
        ) from exc


for _exc_class in (OperationalError, ProgrammingError, ConnectionError):
    app.add_exception_handler(_exc_class, db_error_handler)


@app.get("/api/health")
def health():
    db.init_pool()
    return {"ok": True, "dsn": db.describe_active_dsn().rsplit("@", 1)[-1]}


@app.get("/api/meta")
def meta():
    bounds = queries.snapshot_bounds()
    return {"bounds": bounds, "states": queries.available_states()}


def _global_filter_args(
    date_from: str | None,
    date_to: str | None,
    states: list[str] | None,
) -> tuple[dt.date, dt.date, tuple[str, ...]]:
    """Глобальные фильтры обязательны: фронт всегда отправляет весь период по умолчанию."""
    if not date_from or not date_to:
        bounds = queries.snapshot_bounds()
        date_from = date_from or bounds["min_date"]
        date_to = date_to or bounds["max_date"]
        if not date_from or not date_to:
            raise HTTPException(status_code=503, detail="Нет данных в mart.order_sales")
    return (
        _parse_date(date_from, "date_from"),
        _parse_date(date_to, "date_to"),
        tuple(states) if states else (),
    )


@app.get("/api/overview")
def overview(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    states: list[str] = Query(default=None),
):
    d_from, d_to, st = _global_filter_args(date_from, date_to, states)
    return queries.overview(d_from, d_to, st)


@app.get("/api/delivery")
def delivery(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    states: list[str] = Query(default=None),
    min_orders: int = Query(default=500, ge=1, le=20000),
):
    """Порог штатов фиксирован значением из вопроса 7 (по умолчанию 500)."""
    d_from, d_to, st = _global_filter_args(date_from, date_to, states)
    return queries.delivery(d_from, d_to, st, min_orders)


@app.get("/api/categories")
def categories(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    states: list[str] = Query(default=None),
    category_ids: list[str] = Query(default=None),
    seller_id: str = Query(default=""),
):
    """Локальные фильтры category_ids/seller_id применяются только к этой вкладке."""
    d_from, d_to, st = _global_filter_args(date_from, date_to, states)
    f = queries.SalesFilter(d_from, d_to, st, tuple(category_ids) if category_ids else (),
                            seller_id.strip())
    return {
        "categories": queries.categories_summary(f),
        "sellers": queries.sellers_summary(f),
        "options": queries.categories_options(f),
    }


@app.get("/api/product/champion")
def product_champion():
    champ = queries.price_variety_champion()
    if champ is None:
        raise HTTPException(status_code=404, detail="Нет доставленных позиций")
    return champ


@app.get("/api/product/{product_id}")
def product(product_id: str,
            date_from: str | None = Query(default=None),
            date_to: str | None = Query(default=None),
            states: list[str] = Query(default=None),
            category_ids: list[str] = Query(default=None),
            seller_id: str = Query(default="")):
    d_from, d_to, st = _global_filter_args(date_from, date_to, states)
    f = queries.SalesFilter(d_from, d_to, st, tuple(category_ids) if category_ids else (),
                            seller_id.strip())
    snap = queries.product_snapshot(product_id, f)
    if snap is None:
        raise HTTPException(
            status_code=404,
            detail=f"Товар {product_id} на выбранном срезе не найден.",
        )
    return {
        "product": snap,
        "history": queries.product_price_history(product_id, f),
    }


@app.get("/api/quality")
def quality():
    return queries.quality()
