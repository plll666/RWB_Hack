"""SQL-запросы дашборда: слой данных между Streamlit и витринами mart.

Правила из плана финала (раздеk 4–5):
- обращения идут только к `core`/`mart`, не к `raw`;
- период и штат передаются параметрами (%s), значения не склеиваются со строкой;
- каждая функция отвечает за один экран и возвращает только нужные агрегаты;
- формулы совпадают с `docs/metric_definitions.md` и `model/answers.sql`:
  опоздание = `delivered_at::date > estimated_delivery_at::date`,
  дни доставки = `delivered_at - purchased_at` в сутках (timestamp),
  знаменатель доставки = доставленные заказы с полным набором дат.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import pandas as pd

from dashboard import db


@dataclass(frozen=True)
class Filters:
    """Глобальные фильтры: диапазон даты оформления и штат покупателя."""

    date_from: dt.date
    date_to: dt.date
    states: tuple[str, ...] = ()

    @staticmethod
    def _params(f: "Filters") -> list:
        params: list = [f.date_from, f.date_to]
        if f.states:
            params.append(list(f.states))
        return params

    def where_sales(self) -> tuple[str, list]:
        """WHERE для витрин с столбцами order_date/buyer_state
        (mart.order_sales, mart.sales_item, mart.payment_fact)."""
        clauses = ["order_date >= %s", "order_date <= %s"]
        if self.states:
            clauses.append("buyer_state = ANY(%s)")
        return " AND ".join(clauses), self._params(self)

    def where_delivery(self) -> tuple[str, list]:
        """WHERE для mart.order_delivery: даты тут — purchased_at (timestamp)."""
        clauses = ["purchased_at::date >= %s", "purchased_at::date <= %s"]
        if self.states:
            clauses.append("buyer_state = ANY(%s)")
        return " AND ".join(clauses), self._params(self)


@dataclass(frozen=True)
class SellerFilters:
    """Локальные фильтры вкладки «Категории и продавцы».

    Применяются только к этой вкладке, чтобы заказовые KPI остальных
    вкладок не менялись от категории/продавца.
    """

    global_filters: Filters
    categories: tuple[str, ...] = ()  # ключи категорий (category_id)
    seller_id: str = ""               # точный идентификатор продавца


# --- Общий источник -------------------------------------------------------


def snapshot_bounds() -> pd.DataFrame:
    """Минимум и максимум даты оформления — границы слайдера периода."""
    return db.fetch_df(
        "SELECT min(order_date) AS min_date, max(order_date) AS max_date"
        " FROM mart.order_sales"
    )


def available_states() -> pd.DataFrame:
    """Штаты покупателя, по которым есть заказы в текущем снимке."""
    return db.fetch_df(
        "SELECT DISTINCT buyer_state FROM mart.order_sales"
        " WHERE buyer_state IS NOT NULL ORDER BY buyer_state"
    )


# --- Вкладка «Обзор» ------------------------------------------------------


def overview_kpi(f: Filters) -> pd.DataFrame:
    """Заказы всего, товарная выручка (доставленные, без доставки), средний чек."""
    where, params = f.where_sales()
    return db.fetch_df(
        """
        SELECT
            count(*) AS orders_total,
            sum(merchandise_value) FILTER (WHERE order_status = 'delivered')
                AS revenue,
            avg(full_ticket) FILTER (
                WHERE order_status = 'delivered'
                  AND merchandise_value > 0
            ) AS avg_ticket
        FROM mart.order_sales
        WHERE """
        + where,
        params,
    )


def on_time(f: Filters) -> pd.DataFrame:
    """Доля вовремя: знаменатель — доставленные заказы с полным набором дат."""
    where, params = f.where_delivery()
    return db.fetch_df(
        """
        SELECT
            count(*) AS n_orders,
            count(*) FILTER (WHERE NOT is_late) AS on_time_orders
        FROM mart.order_delivery
        WHERE order_status = 'delivered' AND has_complete_dates AND """
        + where,
        params,
    )


def monthly_trend(f: Filters) -> pd.DataFrame:
    """Помесячная динамика: календарь отдельно — месяцы без заказов не исчезают."""
    where, params = f.where_sales()
    return db.fetch_df(
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
        [f.date_from, f.date_to] + params,
    )


def status_distribution(f: Filters) -> pd.DataFrame:
    """Распределение статусов: один заказ считается один раз."""
    where, params = f.where_sales()
    return db.fetch_df(
        "SELECT order_status, count(*) AS orders"
        " FROM mart.order_sales WHERE "
        + where
        + " GROUP BY order_status ORDER BY orders DESC",
        params,
    )


# --- Вкладка «Доставка» ---------------------------------------------------


def delivery_summary(f: Filters) -> pd.DataFrame:
    """Среднее и медиана дней, доля опозданий. Формулы — как в вопросе 7."""
    where, params = f.where_delivery()
    return db.fetch_df(
        """
        SELECT
            count(*) AS n_orders,
            avg(delivery_days) AS avg_days,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY delivery_days)
                AS median_days,
            count(*) FILTER (WHERE is_late) AS late_orders,
            count(*) FILTER (WHERE is_late)::numeric / count(*) AS late_share
        FROM mart.order_delivery
        WHERE order_status = 'delivered' AND has_complete_dates AND """
        + where,
        params,
    )


def delivery_states(f: Filters, min_orders: int = 500) -> pd.DataFrame:
    """Таблица штатов: тот же знаменатель, порог заказов как в вопросе 7."""
    where, params = f.where_delivery()
    return db.fetch_df(
        """
        SELECT
            buyer_state,
            count(*) AS n_orders,
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


def score_delivery(f: Filters) -> pd.DataFrame:
    """Связь оценки и срока (вопрос 10).

    mart.review_order — уникальные пары заказ/оценка; витринаされていない
    order_date/buyer_state добираем связкой mart.order_sales (1:1 по заказу).
    Ассоциация, не причинность.
    """
    where, params = f.where_sales()
    where = (
        where.replace("order_date", "os.order_date")
        .replace("buyer_state", "os.buyer_state")
    )
    return db.fetch_df(
        """
        SELECT
            ro.review_score,
            count(*) AS n_orders,
            avg(ro.delivery_days) AS avg_days,
            count(*) FILTER (WHERE ro.is_late) AS late_orders,
            count(*) FILTER (WHERE ro.is_late)::numeric / count(*) AS late_share
        FROM mart.review_order ro
        JOIN mart.order_sales os ON os.order_id = ro.order_id
        WHERE ro.order_status = 'delivered'
          AND ro.has_complete_dates
          AND ro.review_score BETWEEN 1 AND 5
          AND """
        + where
        + """
        GROUP BY ro.review_score
        ORDER BY ro.review_score""",
        params,
    )


# --- Вкладка «Категории и продавцы» --------------------------------------


def sales_where(sf: SellerFilters) -> tuple[str, list]:
    """WHERE витрины позиций: глобальные фильтры + локальные категория/продавец."""
    where, params = sf.global_filters.where_sales()
    if sf.categories:
        where += " AND category_id = ANY(%s)"
        params.append(list(sf.categories))
    if sf.seller_id:
        where += " AND seller_id = %s"
        params.append(sf.seller_id)
    return where, params


def category_summary(sf: SellerFilters) -> pd.DataFrame:
    """Категории: выручка на уровне позиций, заказы через count(distinct)."""
    where, params = sales_where(sf)
    return db.fetch_df(
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


def seller_summary(sf: SellerFilters) -> pd.DataFrame:
    """Продавцы: тот же расчёт; идентификатор копируется из таблицы."""
    where, params = sales_where(sf)
    return db.fetch_df(
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


def product_price_history(product_id: str) -> pd.DataFrame:
    """История цен товара: дата, цена, продано единиц (формат вопроса 6)."""
    return db.fetch_df(
        """
        SELECT order_date, item_price, count(*) AS items
        FROM mart.sales_item
        WHERE order_status = 'delivered' AND product_id = %s
        GROUP BY order_date, item_price
        ORDER BY order_date, item_price""",
        [product_id],
    )


def price_variety_champion() -> pd.DataFrame:
    """Товар из вопроса 6: max count(distinct item_price), tie-break — меньший id."""
    return db.fetch_df(
        """
        SELECT product_id, count(DISTINCT item_price) AS n_prices
        FROM mart.sales_item
        WHERE order_status = 'delivered'
        GROUP BY product_id
        ORDER BY n_prices DESC, product_id ASC
        LIMIT 1""",
    )


def product_snapshot(product_id: str) -> pd.DataFrame:
    """Карточка товара: категория и разброс цен по доставленным позициям."""
    return db.fetch_df(
        """
        SELECT si.category_label_english,
               min(si.item_price) AS min_price,
               max(si.item_price) AS max_price,
               avg(si.item_price) AS avg_price,
               count(*) AS items,
               count(DISTINCT si.item_price) AS n_prices,
               count(DISTINCT si.order_id) AS orders
        FROM mart.sales_item si
        WHERE si.order_status = 'delivered' AND si.product_id = %s
        GROUP BY si.category_label_english""",
        [product_id],
    )


def available_categories(sf: SellerFilters) -> pd.DataFrame:
    """Категории, встречающиеся на текущем срезе — источник локального фильтра."""
    where, params = sf.global_filters.where_sales()
    return db.fetch_df(
        """
        SELECT DISTINCT category_id,
               category_label_english AS category_en
        FROM mart.sales_item
        WHERE order_status = 'delivered' AND """
        + where
        + """
        ORDER BY category_id""",
        params,
    )


# --- Вкладка «Качество данных» -------------------------------------------
# Значения считаются запросами к core, а не хранятся константами.
# Повторяют диагностики model/checks.sql (WARN-список),在上海 дашборд
# ссылается на тот же смысл PASS/WARN.


def quality_snapshot() -> pd.DataFrame:
    """Период снимка: границы даты оформления в данных."""
    return db.fetch_df(
        """
        SELECT min(order_date) AS snapshot_from, max(order_date) AS snapshot_to
        FROM mart.order_sales""",
    )


def quality_counts() -> pd.DataFrame:
    """Число строк каждого уровня модели."""
    return db.fetch_df(
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
    )


def quality_missing_dates() -> pd.DataFrame:
    """Пропуски дат: модель оставляет их NULL и не исправляет молча."""
    return db.fetch_df(
        """
        SELECT
            count(*) FILTER (WHERE purchased_at IS NULL)
                AS orders_without_purchase_date,
            count(*) FILTER (WHERE order_status = 'delivered'
                              AND delivered_at IS NULL)
                AS delivered_without_delivery_date,
            count(*) FILTER (WHERE order_status = 'delivered'
                              AND estimated_delivery_at IS NULL)
                AS delivered_without_estimated_date
        FROM core.orders""",
    )


def quality_empty_baskets() -> pd.DataFrame:
    """Заказы без позиций: агрегат NOT EXISTS, без размножения строк."""
    return db.fetch_df(
        """
        SELECT count(*) AS orders_without_items
        FROM core.orders o
        WHERE NOT EXISTS (
            SELECT 1 FROM core.order_item i WHERE i.order_id = o.order_id
        )""",
    )


def quality_payment_mismatch() -> pd.DataFrame:
    """Расхождения платежей и корзины: обе стороны агрегированы до соединения."""
    return db.fetch_df(
        """
        WITH payments AS (
            SELECT order_id, sum(payment_value) AS paid
            FROM core.order_payment
            GROUP BY order_id
        ),
        baskets AS (
            SELECT order_id, sum(item_price + freight_value) AS goods
            FROM core.order_item
            GROUP BY order_id
        )
        SELECT
            count(*) FILTER (
                WHERE p.order_id IS NOT NULL
                  AND abs(b.goods - p.paid) > 0.01
            ) AS mismatched_orders,
            count(*) FILTER (WHERE p.order_id IS NULL) AS basket_without_payment
        FROM baskets b
        LEFT JOIN payments p USING (order_id)""",
    )
