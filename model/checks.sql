-- Blocking assertions raise an exception. With psql -v ON_ERROR_STOP=1
-- any FAIL stops the run with a non-zero exit status.
DO $$
DECLARE
    v_months integer;
    v_zero_months integer;
    v_zero_order_months integer;
    v_revenue numeric;
    v_category_count integer;
    v_category_revenue numeric;
    v_health_beauty numeric;
    v_category_leader text;
    v_average_ticket numeric;
    v_average_lines numeric;
    v_top_seller numeric;
    v_buyers bigint;
    v_repeat_buyers bigint;
BEGIN
    IF (SELECT count(*) FROM raw.orders) <> 99441
       OR (SELECT count(*) FROM raw.order_items) <> 112650
       OR (SELECT count(*) FROM raw.order_payments) <> 103886
       OR (SELECT count(*) FROM raw.order_reviews) <> 99224
       OR (SELECT count(*) FROM raw.products) <> 32951
       OR (SELECT count(*) FROM raw.sellers) <> 3095
       OR (SELECT count(*) FROM raw.customers) <> 99441
       OR (SELECT count(*) FROM raw.product_category_translation) <> 71 THEN
        RAISE EXCEPTION 'FAIL: raw row counts differ from the handout';
    END IF;
    RAISE NOTICE 'PASS: expected raw row counts';

    IF (SELECT count(*) FROM core.orders) <> 99441
       OR (SELECT count(*) FROM core.order_item) <> 112650
       OR (SELECT count(*) FROM core.order_payment) <> 103886
       OR (SELECT count(*) FROM core.order_review) <> 99224
       OR (SELECT count(*) FROM core.product) <> 32951
       OR (SELECT count(*) FROM core.seller) <> 3095
       OR (SELECT count(*) FROM core.customer_record) <> 99441
       OR (SELECT count(*) FROM core.buyer) <> 96096
       OR (SELECT count(*) FROM core.product_category) <> 74 THEN
        RAISE EXCEPTION 'FAIL: core row counts differ from expected source/model counts';
    END IF;
    RAISE NOTICE 'PASS: expected core row counts';

    IF EXISTS (SELECT 1 FROM raw.orders GROUP BY order_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM raw.order_items GROUP BY order_id, order_item_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM raw.order_payments GROUP BY order_id, payment_sequential HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM raw.order_reviews GROUP BY review_id, order_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM raw.products GROUP BY product_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM raw.sellers GROUP BY seller_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM raw.customers GROUP BY customer_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM raw.product_category_translation GROUP BY product_category_name HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'FAIL: duplicate natural keys in raw';
    END IF;
    IF EXISTS (SELECT 1 FROM core.orders GROUP BY order_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.order_item GROUP BY order_id, order_item_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.order_payment GROUP BY order_id, payment_sequential HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.product GROUP BY product_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.seller GROUP BY seller_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.customer_record GROUP BY customer_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.buyer GROUP BY buyer_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.product_category GROUP BY category_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM core.order_review GROUP BY review_row_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'FAIL: duplicate natural/technical keys in core';
    END IF;
    RAISE NOTICE 'PASS: natural keys are unique; review rows retain technical keys';

    IF EXISTS (SELECT 1 FROM core.customer_record r LEFT JOIN core.buyer b ON b.buyer_id = r.buyer_id WHERE b.buyer_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.orders o LEFT JOIN core.customer_record c USING (customer_id) WHERE c.customer_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.product p LEFT JOIN core.product_category c USING (category_id) WHERE c.category_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_item i LEFT JOIN core.orders o USING (order_id) WHERE o.order_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_item i LEFT JOIN core.product p USING (product_id) WHERE p.product_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_item i LEFT JOIN core.seller s USING (seller_id) WHERE s.seller_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_payment p LEFT JOIN core.orders o USING (order_id) WHERE o.order_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_review r LEFT JOIN core.orders o USING (order_id) WHERE o.order_id IS NULL) THEN
        RAISE EXCEPTION 'FAIL: orphan relationships found';
    END IF;
    RAISE NOTICE 'PASS: zero orphan relationships';

    WITH months AS (
        SELECT date '2016-09-01' + n * interval '1 month' AS month_start
        FROM generate_series(0, 23) AS g(n)
    ), monthly_orders AS (
        SELECT date_trunc('month', purchased_at) AS month_start, count(*) AS order_count
        FROM core.orders
        WHERE purchased_at >= timestamp '2016-09-01'
          AND purchased_at < timestamp '2018-09-01'
        GROUP BY 1
    ), monthly_revenue AS (
        SELECT date_trunc('month', o.purchased_at) AS month_start,
               sum(i.item_price) AS revenue
        FROM core.orders o
        JOIN core.order_item i USING (order_id)
        WHERE o.order_status = 'delivered'
          AND o.purchased_at >= timestamp '2016-09-01'
          AND o.purchased_at < timestamp '2018-09-01'
        GROUP BY 1
    )
    SELECT count(*), count(*) FILTER (WHERE coalesce(r.revenue, 0) = 0),
           count(*) FILTER (WHERE coalesce(o.order_count, 0) = 0),
           coalesce(sum(r.revenue), 0)
      INTO v_months, v_zero_months, v_zero_order_months, v_revenue
    FROM months m
    LEFT JOIN monthly_orders o USING (month_start)
    LEFT JOIN monthly_revenue r USING (month_start);
    IF v_months <> 24 OR v_zero_months < 1 OR v_zero_order_months < 1 THEN
        RAISE EXCEPTION 'FAIL: expected 24 months including a zero-order month; got % months, % zero-revenue months and % zero-order months', v_months, v_zero_months, v_zero_order_months;
    END IF;
    RAISE NOTICE 'PASS: 24-month window includes a zero month';
    IF round(v_revenue, 2) IS DISTINCT FROM 13221498.11::numeric THEN
        RAISE EXCEPTION 'FAIL: monthly merchandise revenue is %, expected 13221498.11', v_revenue;
    END IF;
    RAISE NOTICE 'PASS: monthly merchandise revenue total %', v_revenue;

    WITH category_totals AS (
        SELECT c.category_id, c.category_label_english AS category,
               sum(i.item_price) AS revenue
        FROM core.orders o
        JOIN core.order_item i USING (order_id)
        JOIN core.product p USING (product_id)
        JOIN core.product_category c USING (category_id)
        WHERE o.order_status = 'delivered'
          AND o.purchased_at >= timestamp '2016-09-01'
          AND o.purchased_at < timestamp '2018-09-01'
        GROUP BY c.category_id, c.category_label_english
    )
    SELECT count(*), sum(revenue),
           sum(revenue) FILTER (WHERE category = 'health_beauty'),
           (array_agg(category ORDER BY revenue DESC))[1]
      INTO v_category_count, v_category_revenue, v_health_beauty, v_category_leader
    FROM category_totals;
    IF v_category_count <> 74 THEN
        RAISE EXCEPTION 'FAIL: expected 74 selling categories, got %', v_category_count;
    END IF;
    RAISE NOTICE 'PASS: 74 selling categories';
    IF round(v_category_revenue, 2) IS DISTINCT FROM round(v_revenue, 2) THEN
        RAISE EXCEPTION 'FAIL: category revenue % does not reconcile to total %', v_category_revenue, v_revenue;
    END IF;
    RAISE NOTICE 'PASS: category sum reconciles to total revenue';
    IF round(v_health_beauty, 2) IS DISTINCT FROM 1233131.72::numeric THEN
        RAISE EXCEPTION 'FAIL: health_beauty revenue is %, expected 1233131.72', v_health_beauty;
    END IF;
    RAISE NOTICE 'PASS: health_beauty revenue %', v_health_beauty;
    IF v_category_leader IS DISTINCT FROM 'health_beauty' THEN
        RAISE EXCEPTION 'FAIL: leading category is %, expected health_beauty', v_category_leader;
    END IF;
    RAISE NOTICE 'PASS: health_beauty is the leading category';

    WITH order_totals AS (
        SELECT o.order_id, sum(i.item_price + i.freight_value) AS ticket
        FROM core.orders o JOIN core.order_item i USING (order_id)
        WHERE o.order_status = 'delivered'
          AND o.purchased_at >= timestamp '2016-09-01'
          AND o.purchased_at < timestamp '2018-09-01'
        GROUP BY o.order_id
    )
    SELECT avg(ticket) INTO v_average_ticket FROM order_totals;
    IF round(v_average_ticket, 2) IS DISTINCT FROM 159.88::numeric THEN
        RAISE EXCEPTION 'FAIL: average ticket is %, expected 159.88', round(v_average_ticket, 2);
    END IF;
    RAISE NOTICE 'PASS: average ticket %', round(v_average_ticket, 2);
    SELECT avg(item_lines) INTO v_average_lines
    FROM (
        SELECT o.order_id, count(*) AS item_lines
        FROM core.orders o JOIN core.order_item i USING (order_id)
        WHERE o.order_status = 'delivered'
          AND o.purchased_at >= timestamp '2016-09-01'
          AND o.purchased_at < timestamp '2018-09-01'
        GROUP BY o.order_id
    ) line_totals;
    IF round(v_average_lines, 4) IS DISTINCT FROM 1.1422::numeric THEN
        RAISE EXCEPTION 'FAIL: average order lines are %, expected 1.1422', round(v_average_lines, 4);
    END IF;
    RAISE NOTICE 'PASS: average order lines/units %', round(v_average_lines, 4);

    SELECT max(seller_revenue) INTO v_top_seller
    FROM (
        SELECT i.seller_id, sum(i.item_price) AS seller_revenue
        FROM core.orders o JOIN core.order_item i USING (order_id)
        WHERE o.order_status = 'delivered'
          AND o.purchased_at >= timestamp '2016-09-01'
          AND o.purchased_at < timestamp '2018-09-01'
        GROUP BY i.seller_id
    ) seller_totals;
    IF round(v_top_seller, 2) IS DISTINCT FROM 226987.93::numeric THEN
        RAISE EXCEPTION 'FAIL: top seller revenue is %, expected 226987.93', v_top_seller;
    END IF;
    RAISE NOTICE 'PASS: top seller revenue %', v_top_seller;

    SELECT count(*) INTO v_buyers FROM core.buyer;
    SELECT count(*) INTO v_repeat_buyers
    FROM (
        SELECT cr.buyer_id
        FROM core.orders o
        JOIN core.customer_record cr USING (customer_id)
        GROUP BY cr.buyer_id
        HAVING count(*) > 1
    ) repeat_buyers;
    IF v_buyers <> 96096 OR v_repeat_buyers <> 2997 THEN
        RAISE EXCEPTION 'FAIL: buyers/repeat buyers are %/%, expected 96096/2997', v_buyers, v_repeat_buyers;
    END IF;
    RAISE NOTICE 'PASS: buyers %, repeat buyers %, repeat rate %',
        v_buyers, v_repeat_buyers, round(100.0 * v_repeat_buyers / v_buyers, 2);

    -- Answers are reviewed separately and executed after these model checks;
    -- this asserts that their required core subject areas exist.
    IF to_regclass('core.orders') IS NULL OR to_regclass('core.order_item') IS NULL
       OR to_regclass('core.order_payment') IS NULL OR to_regclass('core.product_category') IS NULL
       OR to_regclass('core.buyer') IS NULL OR to_regclass('core.seller') IS NULL THEN
        RAISE EXCEPTION 'FAIL: core relations required by answers are missing';
    END IF;
    RAISE NOTICE 'PASS: core relations required by model/answers.sql exist';
END $$;

-- Non-blocking diagnostics: retain and report source anomalies instead of
-- filtering them away or altering source values.
SELECT 'WARN' AS level, 'orders_without_items' AS check_name, count(*) AS affected_rows
FROM core.orders o LEFT JOIN core.order_item i USING (order_id)
WHERE i.order_id IS NULL
UNION ALL
SELECT 'WARN', 'orders_without_payments', count(*)
FROM core.orders o LEFT JOIN core.order_payment p USING (order_id)
WHERE p.order_id IS NULL
UNION ALL
SELECT 'WARN', 'incomplete_delivery_event_dates', count(*)
FROM core.orders
WHERE handed_to_carrier_at IS NULL OR delivered_at IS NULL
UNION ALL
SELECT 'WARN', 'negative_event_intervals', count(*)
FROM core.orders
WHERE (approved_at IS NOT NULL AND purchased_at IS NOT NULL AND approved_at < purchased_at)
   OR (handed_to_carrier_at IS NOT NULL AND purchased_at IS NOT NULL AND handed_to_carrier_at < purchased_at)
   OR (delivered_at IS NOT NULL AND handed_to_carrier_at IS NOT NULL AND delivered_at < handed_to_carrier_at)
UNION ALL
SELECT 'WARN', 'payment_vs_basket_difference_over_0_01', count(*)
FROM (
    SELECT b.order_id
    FROM (SELECT order_id, sum(item_price + freight_value) AS basket_value
          FROM core.order_item GROUP BY order_id) b
    JOIN (SELECT order_id, sum(payment_value) AS payment_value
          FROM core.order_payment GROUP BY order_id) p USING (order_id)
    WHERE abs(b.basket_value - p.payment_value) > 0.01
) differences
UNION ALL
SELECT 'WARN', 'zero_or_null_product_weight', count(*)
FROM core.product WHERE weight_g IS NULL OR weight_g = 0
UNION ALL
SELECT 'WARN', 'missing_product_category', count(*)
FROM core.product WHERE category_id = '__UNCLASSIFIED__'
UNION ALL
SELECT 'WARN', 'untranslated_product_category', count(*)
FROM core.product p
JOIN core.product_category c USING (category_id)
WHERE c.category_label_english = c.category_id
  AND c.category_id <> '__UNCLASSIFIED__'
  AND NOT EXISTS (
      SELECT 1 FROM raw.product_category_translation t
      WHERE t.product_category_name = c.category_id
  )
ORDER BY check_name;
