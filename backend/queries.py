"""SQL-запросы FastAPI-бэкенда к витринам mart и к core.

Единственный источник определений — docs/metric_definitions.md; формулы те же,
что в model/answers.sql и questions 7/10:
- опоздание = delivered_at::date > estimated_delivery_at::date;
- дни доставки = delivered_at − purchased_at в сутках (timestamp);
- знаменатель доставки = доставленные заказы с полным набором дат;
- обращения только к core/mart, значения — только через %s параметры.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import pandas as pd

from backend import db


@dataclass(frozen=True)
class SalesFilter:
    """Глобальные фильтры (период + исторический штат) для витрин с order_date."""

    date_from: dt.date
    date_to: dt.date
    states: tuple[str, ...] = ()
    categories: tuple[str, ...] = ()   # локальный фильтр вкладки категорий
    seller_id: str = ""                # локальный фильтр вкладки категорий

    def where(self) -> tuple[str, list]:
        clauses = ["order_date >= %s", "order_date <= %s"]
        params: list = [self.date_from, self.date_to]
        if self.states:
            clauses.append("buyer_state = ANY(%s)")
            params.append(list(self.states))
        if self.categories:
            clauses.append("category_id = ANY(%s)")
            params.append(list(self.categories))
        if self.seller_id:
            clauses.append("seller_id = %s")
            params.append(self.seller_id)
        return " AND ".join(clauses), params


@dataclass(frozen=True)
class DeliveryFilter:
    """Тот же глобальный фильтр для mart.order_delivery (purchased_at — timestamp)."""

    date_from: dt.date
    date_to: dt.date
    states: tuple[str, ...] = ()

    def where(self) -> tuple[str, list]:
        clauses = ["purchased_at::date >= %s", "purchased_at::date <= %s"]
        params: list = [self.date_from, self.date_to]
        if self.states:
            clauses.append("buyer_state = ANY(%s)")
            params.append(list(self.states))
        return " AND ".join(clauses), params


# --- Метаданные для фильтров ----------------------------------------------


def snapshot_bounds() -> dict:
    df = db.fetch_df(
        "SELECT min(order_date) AS min_date, max(order_date) AS max_date"
        " FROM mart.order_sales"
    )
    r = df.iloc[0]
    return {
        "min_date": r["min_date"].isoformat() if pd.notna(r["min_date"]) else None,
        "max_date": r["max_date"].isoformat() if pd.notna(r["max_date"]) else None,
    }


def available_states() -> list[str]:
    df = db.fetch_df(
        "SELECT DISTINCT buyer_state FROM mart.order_sales"
        " WHERE buyer_state IS NOT NULL ORDER BY buyer_state"
    )
    return df["buyer_state"].dropna().tolist()


# --- Обзор ---------------------------------------------------------------


def overview(date_from: dt.date, date_to: dt.date, states: tuple[str, ...]) -> dict:
    sf = SalesFilter(date_from, date_to, states)
    where, params = sf.where()
    kpi = db.fetch_df(
        """
        SELECT
            count(*) AS orders_total,
            sum(merchandise_value) FILTER (WHERE order_status = 'delivered') AS revenue,
            avg(full_ticket) FILTER (
                WHERE order_status = 'delivered' AND merchandise_value > 0
            ) AS avg_ticket
        FROM mart.order_sales
        WHERE """
        + where,
        params,
    ).iloc[0]

    dwhere, dparams = DeliveryFilter(date_from, date_to, states).where()
    ot = db.fetch_df(
        """
        SELECT count(*) AS n_orders,
               count(*) FILTER (WHERE NOT is_late) AS on_time_orders
        FROM mart.order_delivery
        WHERE order_status = 'delivered' AND has_complete_dates AND """
        + dwhere,
        dparams,
    ).iloc[0]
    n_orders = int(ot["n_orders"])
    on_time_orders = int(ot["on_time_orders"])

    monthly = db.fetch_df(
        """
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', %s::date),
                date_trunc('month', %s::date),
                interval '1 month'
            )::date AS month
        ),
        agg AS (
            SELECT date_trunc('month', order_date)::date AS month,
                   count(*) AS orders,
                   sum(merchandise_value) FILTER (WHERE order_status = 'delivered')
                       AS revenue
            FROM mart.order_sales
            WHERE """
        + where
        + """
            GROUP BY 1
        )
        SELECT m.month AS month,
               coalesce(a.orders, 0) AS orders,
               coalesce(a.revenue, 0) AS revenue
        FROM months m
        LEFT JOIN agg a ON a.month = m.month
        ORDER BY m.month""",
        [date_from, date_to] + params,
    )

    statuses = db.fetch_df(
        """
        SELECT order_status, count(*) AS orders
        FROM mart.order_sales
        WHERE """
        + where
        + """
        GROUP BY order_status ORDER BY orders DESC""",
        params,
    )
    total = int(statuses["orders"].sum()) if not statuses.empty else 0

    return {
        "kpi": {
            "orders_total": int(kpi["orders_total"]),
            "revenue": float(kpi["revenue"] or 0),
            "avg_ticket": float(kpi["avg_ticket"]) if pd.notna(kpi["avg_ticket"]) else None,
        },
        "on_time": {
            "n_orders": n_orders,
            "on_time_orders": on_time_orders,
            "share": (on_time_orders / n_orders) if n_orders else None,
        },
        "monthly": [
            {
                "month": r["month"].isoformat(),
                "orders": int(r["orders"]),
                "revenue": float(r["revenue"]),
            }
            for _, r in monthly.iterrows()
        ],
        "statuses": [
            {
                "status": r["order_status"],
                "orders": int(r["orders"]),
                "share": (int(r["orders"]) / total) if total else 0,
            }
            for _, r in statuses.iterrows()
        ],
    }


# --- Доставка ------------------------------------------------------------


def delivery(date_from: dt.date, date_to: dt.date, states: tuple[str, ...],
             min_orders: int = 500) -> dict:
    dfilter = DeliveryFilter(date_from, date_to, states)
    where, params = dfilter.where()

    summary = db.fetch_df(
        """
        SELECT
            count(*) AS n_orders,
            avg(delivery_days) AS avg_days,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY delivery_days) AS median_days,
            count(*) FILTER (WHERE is_late) AS late_orders,
            count(*) FILTER (WHERE is_late)::numeric / count(*) AS late_share
        FROM mart.order_delivery
        WHERE order_status = 'delivered' AND has_complete_dates AND """
        + where,
        params,
    ).iloc[0]

    states_df = db.fetch_df(
        """
        SELECT buyer_state, count(*) AS n_orders,
               avg(delivery_days) AS avg_days,
               count(*) FILTER (WHERE is_late) AS late_orders,
               count(*) FILTER (WHERE is_late)::numeric / count(*) AS late_share
        FROM mart.order_delivery
        WHERE order_status = 'delivered' AND has_complete_dates AND """
        + where
        + """
        GROUP BY buyer_state
        HAVING count(*) >= %s
        ORDER BY late_share DESC""",
        params + [min_orders],
    )

    score_clauses = ["os.order_date >= %s", "os.order_date <= %s"]
    score_params: list = [date_from, date_to]
    if states:
        score_clauses.append("os.buyer_state = ANY(%s)")
        score_params.append(list(states))

    scores_df = db.fetch_df(
        """
        SELECT ro.review_score, count(*) AS n_orders,
               avg(ro.delivery_days) AS avg_days,
               count(*) FILTER (WHERE ro.is_late) AS late_orders,
               count(*) FILTER (WHERE ro.is_late)::numeric / count(*) AS late_share
        FROM mart.review_order ro
        JOIN mart.order_sales os ON os.order_id = ro.order_id
        WHERE ro.order_status = 'delivered'
          AND ro.has_complete_dates
          AND ro.review_score BETWEEN 1 AND 5
          AND """
        + " AND ".join(score_clauses)
        + """
        GROUP BY ro.review_score
        ORDER BY ro.review_score""",
        score_params,
    )

    def row(r):
        return {
            "n_orders": int(r["n_orders"]),
            "avg_days": float(r["avg_days"]) if pd.notna(r["avg_days"]) else None,
            "late_orders": int(r["late_orders"]),
            "late_share": float(r["late_share"]) if pd.notna(r["late_share"]) else None,
        }

    return {
        "summary": {
            "n_orders": int(summary["n_orders"]),
            "avg_days": float(summary["avg_days"]) if pd.notna(summary["avg_days"]) else None,
            "median_days": float(summary["median_days"]) if pd.notna(summary["median_days"]) else None,
            "late_orders": int(summary["late_orders"]),
            "late_share": float(summary["late_share"]) if pd.notna(summary["late_share"]) else None,
        },
        "states": [
            {"state": r["buyer_state"], **row(r)} for _, r in states_df.iterrows()
        ],
        "scores": [
            {"score": int(r["review_score"]), **row(r)} for _, r in scores_df.iterrows()
        ],
    }


# --- Категории и продавцы -------------------------------------------------


def categories_options(f: SalesFilter) -> list[dict]:
    where, params = SalesFilter(f.date_from, f.date_to, f.states).where()
    df = db.fetch_df(
        """
        SELECT DISTINCT category_id, category_label_english AS category_en
        FROM mart.sales_item
        WHERE order_status = 'delivered' AND """
        + where
        + " ORDER BY category_id",
        params,
    )
    return df.to_dict("records")


def categories_summary(f: SalesFilter) -> list[dict]:
    where, params = f.where()
    df = db.fetch_df(
        """
        SELECT category_id, category_label_english AS category_en,
               count(DISTINCT order_id) AS orders,
               count(*) AS items,
               sum(item_price) AS revenue
        FROM mart.sales_item
        WHERE order_status = 'delivered' AND """
        + where
        + """
        GROUP BY category_id, category_label_english
        ORDER BY revenue DESC""",
        params,
    )
    return df.to_dict("records")


def sellers_summary(f: SalesFilter) -> list[dict]:
    where, params = f.where()
    df = db.fetch_df(
        """
        SELECT seller_id, seller_state,
               count(DISTINCT order_id) AS orders,
               count(*) AS items,
               sum(item_price) AS revenue
        FROM mart.sales_item
        WHERE order_status = 'delivered' AND """
        + where
        + """
        GROUP BY seller_id, seller_state
        ORDER BY revenue DESC""",
        params,
    )
    return df.to_dict("records")


def price_variety_champion() -> dict | None:
    df = db.fetch_df(
        """
        SELECT product_id, count(DISTINCT item_price) AS n_prices
        FROM mart.sales_item
        WHERE order_status = 'delivered'
        GROUP BY product_id
        ORDER BY n_prices DESC, product_id ASC
        LIMIT 1""",
    )
    if df.empty:
        return None
    r = df.iloc[0]
    return {"product_id": r["product_id"], "n_prices": int(r["n_prices"])}


def product_snapshot(product_id: str, f: SalesFilter) -> dict | None:
    where, params = f.where()
    df = db.fetch_df(
        """
        SELECT si.category_label_english,
               min(si.item_price) AS min_price,
               max(si.item_price) AS max_price,
               avg(si.item_price) AS avg_price,
               count(*) AS items,
               count(DISTINCT si.item_price) AS n_prices,
               count(DISTINCT si.order_id) AS orders
        FROM mart.sales_item si
        WHERE si.order_status = 'delivered' AND si.product_id = %s AND """
        + where
        + """
        GROUP BY si.category_label_english""",
        [product_id] + params,
    )
    if df.empty:
        return None
    r = df.iloc[0]
    return {
        "product_id": product_id,
        "category_en": r["category_label_english"],
        "min_price": float(r["min_price"]),
        "max_price": float(r["max_price"]),
        "avg_price": float(r["avg_price"]),
        "items": int(r["items"]),
        "n_prices": int(r["n_prices"]),
        "orders": int(r["orders"]),
    }


def product_price_history(product_id: str, f: SalesFilter) -> list[dict]:
    where, params = SalesFilter(f.date_from, f.date_to, f.states).where()
    df = db.fetch_df(
        """
        SELECT order_date, item_price, count(*) AS items
        FROM mart.sales_item
        WHERE order_status = 'delivered' AND product_id = %s AND """
        + where
        + """
        GROUP BY order_date, item_price
        ORDER BY order_date, item_price""",
        [product_id] + params,
    )
    return [
        {
            "date": r["order_date"].isoformat(),
            "price": float(r["item_price"]),
            "items": int(r["items"]),
        }
        for _, r in df.iterrows()
    ]


# --- Качество данных ------------------------------------------------------
# Всё считается запросами к core/mart; константы и контрольные значения не хранятся.


def quality() -> dict:
    counts = db.fetch_df(
        """
        SELECT
            (SELECT count(*) FROM core.orders) AS orders,
            (SELECT count(*) FROM core.buyer) AS buyers,
            (SELECT count(*) FROM core.customer_record) AS customer_records,
            (SELECT count(*) FROM core.product_category_version) AS category_versions,
            (SELECT count(*) FROM core.customer_address_version) AS address_versions,
            (SELECT count(*) FROM core.product) AS products,
            (SELECT count(*) FROM core.product_category) AS categories,
            (SELECT count(*) FROM core.seller) AS sellers,
            (SELECT count(*) FROM core.order_item) AS items,
            (SELECT count(*) FROM core.order_payment) AS payments,
            (SELECT count(*) FROM core.order_review) AS reviews""",
    ).iloc[0]

    snap = db.fetch_df(
        "SELECT min(order_date) AS snapshot_from, max(order_date) AS snapshot_to"
        " FROM mart.order_sales"
    ).iloc[0]

    missing = db.fetch_df(
        """
        SELECT
            count(*) FILTER (WHERE purchased_at IS NULL) AS orders_without_purchase_date,
            count(*) FILTER (WHERE order_status = 'delivered' AND delivered_at IS NULL)
                AS delivered_without_delivery_date,
            count(*) FILTER (WHERE order_status = 'delivered'
                              AND estimated_delivery_at IS NULL)
                AS delivered_without_estimated_date
        FROM core.orders""",
    ).iloc[0]

    empty_baskets = db.fetch_df(
        """
        SELECT count(*) AS orders_without_items
        FROM core.orders o
        WHERE NOT EXISTS (
            SELECT 1 FROM core.order_item i WHERE i.order_id = o.order_id
        )""",
    ).iloc[0]["orders_without_items"]

    # Определение расхождения — как в WARN model/checks.sql: только заказы,
    # у которых есть и корзина, и платежи; |разница| > 0.01.
    mismatch = db.fetch_df(
        """
        WITH payments AS (
            SELECT order_id, sum(payment_value) AS paid
            FROM core.order_payment GROUP BY order_id
        ),
        baskets AS (
            SELECT order_id, sum(item_price + freight_value) AS goods
            FROM core.order_item GROUP BY order_id
        )
        SELECT
            count(*) FILTER (
                WHERE p.order_id IS NOT NULL AND abs(b.goods - p.paid) > 0.01
            ) AS mismatched_orders,
            count(*) FILTER (WHERE p.order_id IS NULL) AS basket_without_payment
        FROM baskets b
        LEFT JOIN payments p USING (order_id)""",
    ).iloc[0]

    return {
        "snapshot": {
            "from": snap["snapshot_from"].isoformat() if pd.notna(snap["snapshot_from"]) else None,
            "to": snap["snapshot_to"].isoformat() if pd.notna(snap["snapshot_to"]) else None,
        },
        "counts": {
            "orders": int(counts["orders"]),
            "buyers": int(counts["buyers"]),
            "customer_records": int(counts["customer_records"]),
            "category_versions": int(counts["category_versions"]),
            "address_versions": int(counts["address_versions"]),
            "products": int(counts["products"]),
            "categories": int(counts["categories"]),
            "sellers": int(counts["sellers"]),
            "items": int(counts["items"]),
            "payments": int(counts["payments"]),
            "reviews": int(counts["reviews"]),
        },
        "missing": {
            "orders_without_purchase_date": int(missing["orders_without_purchase_date"]),
            "delivered_without_delivery_date": int(missing["delivered_without_delivery_date"]),
            "delivered_without_estimated_date": int(missing["delivered_without_estimated_date"]),
        },
        "orders_without_items": int(empty_baskets),
        "payment_mismatch": {
            "mismatched_orders": int(mismatch["mismatched_orders"]),
            "basket_without_payment": int(mismatch["basket_without_payment"]),
        },
    }
