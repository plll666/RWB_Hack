"""Streamlit-дашборд исторической выгрузки Olist (до октября 2018).

Структура по плану финала (раздел 5.5):
- вкладки: Обзор, Доставка, Категории и продавцы, Качество данных;
- глобальные фильтры: диапазон даты оформления и штат покупателя;
- категория и продавец — локальные фильтры только своей вкладки;
- все обращения только к core/mart, значения через параметры;
- пустой срез показывает «Нет данных», а не нули;
- у метрик доставки всегда виден знаменатель.

Запуск из корня репозитория:
    streamlit run dashboard/app.py
"""

from __future__ import annotations

import pathlib
import sys

import pandas as pd
import streamlit as st

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import psycopg2  # noqa: E402

from dashboard import db, queries  # noqa: E402

MIN_ORDERS_PER_STATE = 500  # порог вопроса 7: HAVING count(*) >= 500
HISTORY_CAPTION = "Историческая выгрузка Olist: данные до октября 2018"

st.set_page_config(page_title="Olist — дашборд", layout="wide")
st.title("Olist Marketplace: анализ исторических данных")
st.caption(
    HISTORY_CAPTION
    + " · Источник: PostgreSQL (raw → core → mart) · аналитика исторической выгрузки, не реальное время"
)


# --- helpers --------------------------------------------------------------


def fmt_money(v) -> str:
    if v is None or pd.isna(v):
        return "—"
    return f"R$ {float(v):,.2f}".replace(",", " ")


def fmt_pct(v) -> str:
    if v is None or pd.isna(v):
        return "—"
    return f"{float(v) * 100:,.2f} %".replace(",", " ")


def fmt_days(v) -> str:
    if v is None or pd.isna(v):
        return "—"
    return f"{float(v):,.2f}".replace(",", " ")


def fmt_int(v) -> str:
    try:
        return f"{int(v):,}".replace(",", " ")
    except (TypeError, ValueError):
        return "—"


def show_empty(message: str = "Нет данных — на выбранном срезе заказов нет.") -> bool:
    st.info(message)
    return True


@st.cache_data(show_spinner=False)
def _view_bounds() -> tuple:
    row = queries.snapshot_bounds().iloc[0]
    return row["min_date"], row["max_date"]


@st.cache_data(show_spinner=False)
def _view_states() -> list:
    return queries.available_states()["buyer_state"].dropna().tolist()


@st.cache_data(show_spinner=True)
def _fetch(fn_name: str, params: tuple):
    """Единая точка вызова слоя запросов с кэшем по параметрам фильтров."""
    return getattr(queries, fn_name)(*params)


# --- подключение ---------------------------------------------------------


@st.cache_resource(show_spinner=False)
def _connect_bootstrap() -> str:
    return db.resolve_dsn()


try:
    active_dsn = _connect_bootstrap()
except Exception as exc:
    st.error("## Нет доступа к PostgreSQL")
    st.markdown(
        """
        Дашборд работает только на учебной базе из README проекта.

        1. Запустите базу:  `bash scripts/setup.sh`
        2. Соберите модель по последовательности из README:
           `model/build.sql` → `model/mart.sql` → `model/checks.sql`
        3. Если база не на `localhost:5433`, задайте `DATABASE_URL`, например:
           `export DATABASE_URL=postgresql://hack:hack@localhost:5432/marketplace`
        4. Перезапустите приложение:  `streamlit run dashboard/app.py`
        """
    )
    with st.expander("Детали ошибки подключения", expanded=False):
        st.code(str(exc))
    st.stop()

try:
    min_date, max_date = _view_bounds()
    states_all = _view_states()
except (psycopg2.Error, ConnectionError) as exc:
    st.error(
        "Подключение есть, но обращения к mart/core падают. Похоже, модель не собрана:"
        " выполните `model/build.sql` и `model/mart.sql` по последовательности из README"
        " и обновите страницу."
    )
    with st.expander("Детали ошибки запроса", expanded=False):
        st.code(str(exc))
    st.stop()

# --- глобальные фильтры ---------------------------------------------------

with st.sidebar:
    st.subheader("Фильтры")
    default_from = pd.Timestamp(min_date).date()
    default_to = pd.Timestamp(max_date).date()
    period = st.date_input(
        "Период оформления заказа",
        value=(default_from, default_to),
        min_value=default_from,
        max_value=default_to,
        help="Глобальный фильтр для всех вкладок: order_date из mart.order_sales.",
    )
    if len(period) == 2:
        date_from, date_to = period
    else:
        date_from = date_to = default_from
        st.warning("Выберите начало и конец периода.")
    states = st.multiselect(
        "Штат покупателя (исторический)",
        states_all,
        default=[],
        placeholder="Все штаты",
        help=(
            "Штат заказ-address версии покупателя на момент оформления заказа"
            " (core.customer_address_version через mart.order_sales)."
        ),
    )
    filters = queries.Filters(date_from, date_to, tuple(states))
    st.caption(HISTORY_CAPTION)
    st.caption(f"БД: {active_dsn.rsplit('@', 1)[-1]}")

tab_overview, tab_delivery, tab_cat, tab_quality = st.tabs(
    ["Обзор", "Доставка", "Категории и продавцы", "Качество данных"]
)

f = filters

# --- «Обзор» --------------------------------------------------------------

with tab_overview:
    st.header("Обзор выгрузки на выбранном срезе")
    kpi = _fetch("overview_kpi", (f,))
    ot = _fetch("on_time", (f,))
    if kpi is None or kpi.empty or ot is None or ot.empty:
        show_empty()
        st.stop()
    k = kpi.iloc[0]
    o = ot.iloc[0]
    on_time_share = (
        float(o["on_time_orders"]) / float(o["n_orders"]) if float(o["n_orders"]) else None
    )
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Заказы", fmt_int(k["orders_total"]), help="Все статусы, выбранный период")
    c2.metric(
        "Выручка",
        f"R$ {float(k['revenue']) / 1e6:,.2f} млн".replace(",", " "),
        help=f"Товарная выручка доставленных: {fmt_money(k['revenue'])}",
    )
    c3.metric(
        "Средний чек",
        fmt_money(k["avg_ticket"]),
        help=(
            "Товары + доставка на доставленный заказ с позициями:"
            " full_ticket, один заказ — одна строка."
        ),
    )
    c4.metric("Вовремя, %", fmt_pct(on_time_share))
    st.caption(
        f"Знаменатель: {fmt_int(o['n_orders'])} доставленных заказов с датами"
        " оформления, доставки и обещанной датой. Заказы других статусов"
        " в метрику вовремя не входят; выручка считается только по доставленным."
    )

    monthly = _fetch("monthly_trend", (f,))
    left, right = st.columns(2)
    with left:
        st.subheader("Заказы по месяцам")
        st.line_chart(
            monthly.rename(columns={"month": "Месяц", "orders": "Заказы"}),
            x="Месяц", y="Заказы",
        )
    with right:
        st.subheader("Товарная выручка по месяцам")
        st.line_chart(
            monthly.rename(columns={"month": "Месяц", "revenue": "Выручка, R$"}),
            x="Месяц", y="Выручка, R$",
        )
    st.caption(
        "Выручка месяца = сумма цен позиций доставленных заказов этого месяца (без доставки)."
        " Месяцы без заказов остаются на графике с нулевой отметкой."
    )

    st.subheader("Распределение статусов заказов")
    statuses = _fetch("status_distribution", (f,))
    st.bar_chart(
        statuses.rename(columns={"order_status": "Статус", "orders": "Заказы"}),
        x="Статус", y="Заказы",
    )
    st.caption("Каждый заказ учтён один раз; доли статусов дают в сумме 100%.")

# --- «Доставка» -----------------------------------------------------------

with tab_delivery:
    st.header("Доставка: сроки, опоздания, связь с оценками")
    st.caption(
        "Знаменатель везде: доставленные заказы с полным набором дат"
        " (оформление, доставка, обещанная дата). Формула как в вопросе 7:"
        " опоздание = delivered_at::date > estimated_delivery_at::date."
        " Формулы совпадают с model/answers.sql (вопросы 7 и 10)."
    )
    dsum = _fetch("delivery_summary", (f,))
    if dsum is None or dsum.empty:
        show_empty()
        st.stop()
    d = dsum.iloc[0]
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Заказов в расчёте", fmt_int(d["n_orders"]))
    m2.metric("Средняя доставка, дней", fmt_days(d["avg_days"]))
    m3.metric("Медианная доставка, дней", fmt_days(d["median_days"]))
    m4.metric(
        "Опоздали",
        fmt_pct(d["late_share"]),
        help=f"Опоздавших заказов: {fmt_int(d['late_orders'])}",
    )

    st.subheader("Штаты: срок и доля опозданий")
    st.caption(f"Знаменатель каждой строки виден в столбце «Заказов в расчёте».")
    min_orders = st.number_input(
        "Порог числа заказов, как в вопросе 7 (≥ 500)",
        min_value=1,
        max_value=20000,
        value=MIN_ORDERS_PER_STATE,
        step=50,
    )
    dstates = _fetch("delivery_states", (f, int(min_orders)))
    if dstates is None or dstates.empty:
        st.info("Ни один штат не проходит порог на этом срезе.")
    else:
        st.dataframe(
            dstates,
            column_config={
                "buyer_state": st.column_config.TextColumn("Штат"),
                "n_orders": st.column_config.NumberColumn("Заказов в расчёте", format="%d"),
                "avg_days": st.column_config.NumberColumn("Средняя, дней", format="%.2f"),
                "late_orders": st.column_config.NumberColumn("Опоздавших", format="%d"),
                "late_share": st.column_config.NumberColumn("Доля опозданий", format="percent"),
            },
            use_container_width=True,
        )

    st.subheader("Связь оценки и срока доставки")
    score = _fetch("score_delivery", (f,))
    if score is None or score.empty:
        st.info("Нет данных — на срезе нет доставленных заказов с оценками и полным набором дат.")
    else:
        st.dataframe(
            score,
            column_config={
                "review_score": st.column_config.NumberColumn("Оценка 1–5", format="%d"),
                "n_orders": st.column_config.NumberColumn("Заказов в расчёте", format="%d"),
                "avg_days": st.column_config.NumberColumn("Средняя, дней", format="%.2f"),
                "late_orders": st.column_config.NumberColumn("Опоздавших", format="%d"),
                "late_share": st.column_config.NumberColumn("Доля опозданий", format="percent"),
            },
            use_container_width=True,
        )
        st.caption(
            "Каждая уникальная пара заказ/оценка учитывается один раз (mart.review_order)."
            " Дни и опоздание считаются той же формулой, что и в блоке доставки."
            " Это наблюдаемая ассоциация, не доказательство причинности."
        )

# --- «Категории и продавцы» ----------------------------------------------

with tab_cat:
    st.header("Категории и продавцы на срезе")
    st.caption(
        "Локальные фильтры этой вкладки не применяются к KPI других вкладок."
        " Выручка = сумма цен позиций доставленных заказов;"
        " заказы = count(distinct order_id)."
    )
    cat_opts = _fetch("available_categories", (queries.SellerFilters(f),))
    if cat_opts is None or cat_opts.empty:
        show_empty("На выбранном срезе нет позиций — фильтры вкладки не к чему применить.")
        st.stop()
    cat_options = cat_opts.assign(
        label=cat_opts["category_id"] + " (" + cat_opts["category_en"] + ")"
    )
    chosen_labels = st.multiselect(
        "Категории",
        cat_options["label"].tolist(),
        default=[],
        placeholder="Все категории",
    )
    label_to_id = dict(zip(cat_options["label"], cat_options["category_id"]))
    chosen_cats = tuple(label_to_id[lab] for lab in chosen_labels)

    seller_id_input = st.text_input(
        "ID продавца (точный, можно скопировать из таблицы ниже)",
        value="",
        placeholder="например 4869f7a5dfa277a7dca6462dcf3b52b2",
    )
    sf = queries.SellerFilters(f, chosen_cats, seller_id_input.strip())

    left, right = st.columns(2)
    with left:
        st.subheader("Категории")
        cats = _fetch("category_summary", (sf,))
        if cats is None or cats.empty:
            st.info("Нет данных — попробуйте другой период или категорию.")
        else:
            st.dataframe(
                cats,
                column_config={
                    "category_id": st.column_config.TextColumn("Ключ", width="large"),
                    "category_en": st.column_config.TextColumn("Категория", width="large"),
                    "orders": st.column_config.NumberColumn("Заказы", format="%d"),
                    "items": st.column_config.NumberColumn("Позиции", format="%d"),
                    "revenue": st.column_config.NumberColumn("Товарная выручка, R$", format="%.2f"),
                },
                use_container_width=True,
                height=420,
            )
    with right:
        st.subheader("Продавцы")
        sellers = _fetch("seller_summary", (sf,))
        if sellers is None or sellers.empty:
            st.info("Нет данных — ослабьте фильтры вкладки.")
        else:
            st.dataframe(
                sellers,
                column_config={
                    "seller_id": st.column_config.TextColumn("ID продавца", width="large"),
                    "seller_state": st.column_config.TextColumn("Штат"),
                    "orders": st.column_config.NumberColumn("Заказы", format="%d"),
                    "items": st.column_config.NumberColumn("Позиции", format="%d"),
                    "revenue": st.column_config.NumberColumn("Товарная выручка, R$", format="%.2f"),
                },
                use_container_width=True,
                height=420,
            )
    st.caption(
        f"На срезе: продавцов {fmt_int(sellers.shape[0] if sellers is not None else 0)},"
        f" категорий {fmt_int(cats.shape[0] if cats is not None else 0)}."
    )

    st.divider()
    st.subheader("История цены товара (вопрос 6)")
    champ = _fetch("price_variety_champion", ())
    champion_id = champ.iloc[0]["product_id"] if champ is not None and not champ.empty else ""
    product_input = st.text_input(
        "product_id",
        value=champion_id,
        help=(
            "По умолчанию подставлен товар из вопроса 6:"
            " наибольшее число различных цен среди доставленных позиций."
        ),
    )
    pid = product_input.strip()
    if not pid:
        st.info("Вставьте product_id — построится история цен без ручного ввода результатов.")
    else:
        snap = _fetch("product_snapshot", (pid,))
        if snap is None or snap.empty:
            st.info(
                f"Товар {pid} на выбранном срезе доставленных позиций не найден."
                " Снимите фильтр периода/штата/категории или выберите другой товар."
            )
        else:
            s = snap.iloc[0]
            pc1, pc2, pc3, pc4, pc5 = st.columns(5)
            pc1.metric("Категория", s["category_label_english"])
            pc2.metric("Позиций", fmt_int(s["items"]))
            pc3.metric("Различных цен", fmt_int(s["n_prices"]))
            pc4.metric("Заказов", fmt_int(s["orders"]))
            pc5.metric(
                "Диапазон цен",
                f"{fmt_money(s['min_price'])} … {fmt_money(s['max_price'])}",
            )
            hist = _fetch("product_price_history", (pid,))
            if hist is None or hist.empty:
                st.info("Нет данных по этому товару на выбранном срезе.")
            else:
                with st.expander("График: дата → цена (число проданных единиц)", expanded=True):
                    st.line_chart(
                        hist.rename(columns={"order_date": "Дата", "item_price": "Цена, R$"}),
                        x="Дата", y="Цена, R$",
                    )
                with st.expander("Таблица: дата, цена, продано единиц"):
                    st.dataframe(
                        hist,
                        column_config={
                            "order_date": st.column_config.DateColumn("Дата"),
                            "item_price": st.column_config.NumberColumn("Цена, R$", format="%.2f"),
                            "items": st.column_config.NumberColumn("Продано единиц", format="%d"),
                        },
                        use_container_width=True,
                    )
                st.caption(
                    "Гранулярность — позиция заказа (order_item); формат точно"
                    " соответствует вопросу 6 блока Б."
                )

# --- «Качество данных» ---------------------------------------------------

with tab_quality:
    st.header("Качество данных и смысл проверок")
    st.caption(
        "Все значения считаются запросами к core/mart — констант на экране нет."
        " Пороги и определения совпадают с model/checks.sql, чтобы PASS/WARN"
        " означали одно и то же в SQL и в интерфейсе."
    )
    qcount = _fetch("quality_counts", ())
    qsnap = _fetch("quality_snapshot", ())
    qmiss = _fetch("quality_missing_dates", ())
    qempty = _fetch("quality_empty_baskets", ())
    qmism = _fetch("quality_payment_mismatch", ())
    if any(x is None or x.empty for x in (qcount, qsnap, qmiss, qempty, qmism)):
        st.stop()

    snap = qsnap.iloc[0]
    cc = qcount.iloc[0]
    ms = qmiss.iloc[0]
    cards = [
        ("Период снимка",
         f"{snap['snapshot_from']} … {snap['snapshot_to']}",
         "Границы даты оформления заказов в данных"),
        ("Заказы", fmt_int(cc["orders"]), "core.orders"),
        ("Записи покупателей / адресные версии",
         f"{fmt_int(cc['customer_records'])} / {fmt_int(cc['address_versions'])}",
         "core.customer_record / core.customer_address_version"),
        ("Товары / категорийные версии",
         f"{fmt_int(cc['products'])} / {fmt_int(cc['category_versions'])}",
         "core.product / core.product_category_version"),
        ("Позиции", fmt_int(cc["items"]), "core.order_item"),
        ("Платежи", fmt_int(cc["payments"]), "core.order_payment"),
        ("Отзывы", fmt_int(cc["reviews"]), "core.order_review"),
        ("Постоянных покупателей", fmt_int(cc["buyers"]), "core.buyer"),
        ("Продавцы", fmt_int(cc["sellers"]), "core.seller"),
        ("Категории", fmt_int(cc["categories"]), "core.product_category"),
    ]
    slots = st.columns(5)
    for i, (name, value, hint) in enumerate(cards):
        with slots[i % len(slots)]:
            st.metric(name, value, help=hint)

    st.subheader("Осталось NULL или разошлось (не исправлено молча)")
    q1, q2, q3 = st.columns(3)
    with q1:
        st.markdown("**Пропуски дат**")
        st.write(
            f"- Заказов без даты оформления: **{fmt_int(ms['orders_without_purchase_date'])}**"
            f"\n- Доставленных без даты доставки: **{fmt_int(ms['delivered_without_delivery_date'])}**"
            f"\n- Доставленных без обещанной даты: **{fmt_int(ms['delivered_without_estimated_date'])}**"
        )
    with q2:
        st.markdown("**Корзины**")
        st.write(
            f"- Заказов без единой позиции: **{fmt_int(qempty.iloc[0]['orders_without_items'])}**"
            " — в источнике есть заказы с платежами и без позиций"
        )
    with q3:
        st.markdown("**Платежи против корзины**")
        st.write(
            f"- Заказов с |платёж − корзина| &gt; 0.01: **{fmt_int(qmism.iloc[0]['mismatched_orders'])}**"
            f"\n- Корзин без платежа: **{fmt_int(qmism.iloc[0]['basket_without_payment'])}**"
        )
    st.caption(
        "Значения совпадают с секцией WARN model/checks.sql: определения и пороги идентичны."
    )

    st.subheader("Что означают PASS / WARN в checks.sql")
    st.write(
        """
- **PASS** — блокирующие утверждения: число строк, уникальность ключей, отсутствие
  сиротских ссылок, непересекающиеся исторические интервалы, совпадение формул доставки
  в вопросах 7/10 и дашборде, порог штатов 500, детерминированный выбор товара в вопросе 6.
- **WARN** — неблокирующие аномалии источника: пропуски дат, заказы без позиций,
  расхождения платежей и корзины, отрицательные интервалы. Аномалии не исправляются
  молча: они остаются NULL/отдельными числами и учтены в знаменателях метрик.
"""
    )
