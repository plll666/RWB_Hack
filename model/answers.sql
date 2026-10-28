-- Answers to the case questions. Revenue means merchandise value (item_price),
-- excludes freight, and includes delivered orders only. The analysis window
-- is [2016-09-01, 2018-09-01), matching the first five questions.

-- 1. Monthly order count and merchandise revenue. Keep empty months and
-- count all placed orders; revenue is credited only for delivered orders.
WITH months AS (
    SELECT date '2016-09-01' + n * interval '1 month' AS month_start
    FROM generate_series(0, 23) AS g(n)
), monthly_orders AS (
    SELECT date_trunc('month', purchased_at) AS month_start,
           count(*) AS order_count
    FROM core.orders
    WHERE purchased_at >= timestamp '2016-09-01'
      AND purchased_at <  timestamp '2018-09-01'
    GROUP BY 1
), monthly_revenue AS (
    SELECT date_trunc('month', o.purchased_at) AS month_start,
           sum(i.item_price) AS revenue
    FROM core.orders o
    JOIN core.order_item i USING (order_id)
    WHERE o.order_status = 'delivered'
      AND o.purchased_at >= timestamp '2016-09-01'
      AND o.purchased_at <  timestamp '2018-09-01'
    GROUP BY 1
)
SELECT to_char(m.month_start, 'YYYY-MM') AS month,
       coalesce(o.order_count, 0) AS order_count,
       coalesce(r.revenue, 0)::numeric(14,2) AS revenue
FROM months m
LEFT JOIN monthly_orders o USING (month_start)
LEFT JOIN monthly_revenue r USING (month_start)
ORDER BY m.month_start;

-- 2. Top 10 sellers: aggregate at order item grain before ranking sellers.
SELECT s.seller_id, s.city, s.state_code,
       count(DISTINCT o.order_id) AS order_count,
       count(*) AS item_units,
       sum(i.item_price)::numeric(14,2) AS revenue
FROM core.order_item i
JOIN core.orders o USING (order_id)
JOIN core.seller s USING (seller_id)
WHERE o.order_status = 'delivered'
  AND o.purchased_at >= timestamp '2016-09-01'
  AND o.purchased_at <  timestamp '2018-09-01'
GROUP BY s.seller_id, s.city, s.state_code
ORDER BY revenue DESC
LIMIT 10;

-- 3. First compute one complete basket per order. The average ticket includes
-- freight; averages are over delivered orders in the analysis window.
WITH basket AS (
    SELECT o.order_id,
           sum(i.item_price + i.freight_value) AS ticket,
           count(*) AS item_lines,
           count(*) AS item_units
    FROM core.orders o
    JOIN core.order_item i USING (order_id)
    WHERE o.order_status = 'delivered'
      AND o.purchased_at >= timestamp '2016-09-01'
      AND o.purchased_at <  timestamp '2018-09-01'
    GROUP BY o.order_id
)
SELECT avg(ticket)::numeric(14,2) AS average_ticket,
       avg(item_lines)::numeric(14,4) AS average_lines_per_order,
       avg(item_units)::numeric(14,4) AS average_units_per_order
FROM basket;

-- 4. Count enduring buyer identities, not order-scoped customer records.
WITH buyer_orders AS (
    SELECT cr.buyer_id, count(*) AS order_count
    FROM core.orders o
    JOIN core.customer_record cr USING (customer_id)
    GROUP BY cr.buyer_id
)
SELECT count(*) AS buyers,
       count(*) FILTER (WHERE order_count > 1) AS repeat_buyers,
       round(100.0 * count(*) FILTER (WHERE order_count > 1) / count(*), 2)
           AS repeat_buyer_pct
FROM buyer_orders;

-- 5. Category revenue, including the explicit unclassified bucket and the
-- untranslated source category names. Revenue excludes freight.
WITH category_revenue AS (
    SELECT c.category_id,
           c.category_label_english AS category,
           sum(i.item_price) AS revenue
    FROM core.order_item i
    JOIN core.orders o USING (order_id)
    JOIN core.product p USING (product_id)
    JOIN core.product_category c USING (category_id)
    WHERE o.order_status = 'delivered'
      AND o.purchased_at >= timestamp '2016-09-01'
      AND o.purchased_at <  timestamp '2018-09-01'
    GROUP BY c.category_id, c.category_label_english
)
SELECT category_id,
       category,
       revenue::numeric(14,2) AS revenue,
       round(100.0 * revenue / sum(revenue) OVER (), 2) AS share_pct
FROM category_revenue
ORDER BY revenue DESC;
