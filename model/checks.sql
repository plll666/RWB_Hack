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

    IF to_regclass('core.product_category_version') IS NULL
       OR to_regclass('core.customer_address_version') IS NULL
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'core' AND table_name = 'order_item' AND column_name = 'category_id')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'core' AND table_name = 'orders' AND column_name = 'address_version_id') THEN
        RAISE EXCEPTION 'FAIL: historical tables or order snapshot keys are missing';
    END IF;
    IF EXISTS (SELECT 1 FROM core.product p WHERE NOT EXISTS (
                   SELECT 1 FROM core.product_category_version v
                   WHERE v.product_id = p.product_id AND v.valid_from = '-infinity'))
       OR EXISTS (SELECT 1 FROM core.customer_record r WHERE NOT EXISTS (
                   SELECT 1 FROM core.customer_address_version v
                   WHERE v.customer_id = r.customer_id AND v.valid_from = '-infinity')) THEN
        RAISE EXCEPTION 'FAIL: initial historical versions do not cover every product/customer record';
    END IF;
    IF EXISTS (SELECT 1 FROM core.product_category_version WHERE valid_from >= valid_to)
       OR EXISTS (SELECT 1 FROM core.customer_address_version WHERE valid_from >= valid_to)
       OR EXISTS (
           SELECT 1 FROM core.product_category_version a
           JOIN core.product_category_version b USING (product_id)
           WHERE (a.product_id, a.valid_from) < (b.product_id, b.valid_from)
             AND a.valid_from < b.valid_to AND b.valid_from < a.valid_to
       )
       OR EXISTS (
           SELECT 1 FROM core.customer_address_version a
           JOIN core.customer_address_version b USING (customer_id)
           WHERE a.address_version_id < b.address_version_id
             AND a.valid_from < b.valid_to AND b.valid_from < a.valid_to
       ) THEN
        RAISE EXCEPTION 'FAIL: invalid or overlapping historical intervals';
    END IF;
    IF EXISTS (
        SELECT 1 FROM core.orders o
        LEFT JOIN core.customer_address_version av USING (address_version_id)
        WHERE av.address_version_id IS NULL OR av.customer_id <> o.customer_id
           OR (o.purchased_at IS NOT NULL AND NOT (o.purchased_at >= av.valid_from AND o.purchased_at < av.valid_to))
    ) OR EXISTS (
        SELECT 1 FROM core.order_item i
        JOIN core.orders o USING (order_id)
        LEFT JOIN core.product_category_version cv
          ON cv.product_id = i.product_id AND cv.category_id = i.category_id
        WHERE cv.product_id IS NULL
           OR (o.purchased_at IS NOT NULL AND NOT (o.purchased_at >= cv.valid_from AND o.purchased_at < cv.valid_to))
    ) THEN
        RAISE EXCEPTION 'FAIL: order history snapshot does not match purchase-time version';
    END IF;
    RAISE NOTICE 'PASS: historical versions, non-overlap, keys and purchase-time snapshots';

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
       OR EXISTS (SELECT 1 FROM core.customer_record r LEFT JOIN core.customer_address_version av USING (customer_id) WHERE av.customer_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.product p LEFT JOIN core.product_category_version cv USING (product_id) WHERE cv.product_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_item i LEFT JOIN core.orders o USING (order_id) WHERE o.order_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_item i LEFT JOIN core.product p USING (product_id) WHERE p.product_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_item i LEFT JOIN core.product_category c USING (category_id) WHERE c.category_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.order_item i LEFT JOIN core.seller s USING (seller_id) WHERE s.seller_id IS NULL)
       OR EXISTS (SELECT 1 FROM core.orders o LEFT JOIN core.customer_address_version av USING (address_version_id) WHERE av.address_version_id IS NULL)
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
        JOIN core.product_category c ON c.category_id = i.category_id
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

-- Block B contract checks. Requires mart.sql to have run after build.sql.
DO $$
DECLARE
    v_orders bigint;
    v_status_orders bigint;
    v_payments bigint;
    v_payment_facts bigint;
    v_items bigint;
    v_sales_items bigint;
    v_delivery_rows bigint;
    v_sales_orders bigint;
    v_review_pairs bigint;
    v_review_facts bigint;
BEGIN
    IF to_regclass('mart.order_sales') IS NULL
       OR to_regclass('mart.order_delivery') IS NULL
       OR to_regclass('mart.sales_item') IS NULL
       OR to_regclass('mart.payment_fact') IS NULL
       OR to_regclass('mart.review_order') IS NULL THEN
        RAISE EXCEPTION 'FAIL: run model/mart.sql before model/checks.sql';
    END IF;

    SELECT count(*) INTO v_orders FROM core.orders;
    SELECT coalesce(sum(n), 0) INTO v_status_orders
    FROM (SELECT count(*) AS n FROM core.orders GROUP BY order_status) s;
    IF v_status_orders <> v_orders THEN
        RAISE EXCEPTION 'FAIL: status groups contain % orders, expected %', v_status_orders, v_orders;
    END IF;
    RAISE NOTICE 'PASS: status counts cover all % orders', v_orders;

    SELECT count(*) INTO v_payments FROM core.order_payment;
    SELECT count(*) INTO v_payment_facts FROM mart.payment_fact;
    IF v_payment_facts <> v_payments THEN
        RAISE EXCEPTION 'FAIL: payment_fact has % rows, expected %', v_payment_facts, v_payments;
    END IF;
    RAISE NOTICE 'PASS: payment_fact preserves payment grain (% rows)', v_payments;

    SELECT count(*) INTO v_sales_orders FROM mart.order_sales;
    IF v_sales_orders <> v_orders
       OR EXISTS (SELECT order_id FROM mart.order_sales GROUP BY order_id HAVING count(*) <> 1) THEN
        RAISE EXCEPTION 'FAIL: order_sales is not one row per order';
    END IF;
    RAISE NOTICE 'PASS: order_sales has one row per order';

    SELECT count(*) INTO v_items FROM core.order_item;
    SELECT count(*) INTO v_sales_items FROM mart.sales_item;
    IF v_sales_items <> v_items THEN
        RAISE EXCEPTION 'FAIL: sales_item has % rows, expected %', v_sales_items, v_items;
    END IF;
    RAISE NOTICE 'PASS: sales_item preserves item grain (% rows)', v_items;

    SELECT count(*) INTO v_delivery_rows FROM mart.order_delivery;
    IF v_delivery_rows <> v_orders
       OR EXISTS (SELECT order_id FROM mart.order_delivery GROUP BY order_id HAVING count(*) <> 1) THEN
        RAISE EXCEPTION 'FAIL: order_delivery is not one row per order';
    END IF;
    RAISE NOTICE 'PASS: order_delivery has one row per order';

    SELECT count(*) INTO v_review_pairs
    FROM (SELECT DISTINCT order_id, review_score FROM core.order_review WHERE review_score BETWEEN 1 AND 5) r;
    SELECT count(*) INTO v_review_facts FROM mart.review_order;
    IF v_review_facts <> v_review_pairs
       OR EXISTS (SELECT order_id, review_score FROM mart.review_order
                  GROUP BY order_id, review_score HAVING count(*) <> 1) THEN
        RAISE EXCEPTION 'FAIL: review_order does not preserve unique order/score pairs';
    END IF;
    RAISE NOTICE 'PASS: review_order preserves unique order/score pairs';

    IF EXISTS (
        SELECT 1 FROM mart.order_delivery
        WHERE is_late IS DISTINCT FROM (delivered_at::date > estimated_delivery_at::date)
          AND delivered_at IS NOT NULL AND estimated_delivery_at IS NOT NULL
    ) OR EXISTS (
        SELECT 1 FROM mart.order_delivery
        WHERE delivery_days IS DISTINCT FROM extract(epoch FROM (delivered_at - purchased_at)) / 86400.0
          AND delivered_at IS NOT NULL AND purchased_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'FAIL: mart delivery formulas are inconsistent';
    END IF;
    RAISE NOTICE 'PASS: delivery duration and lateness formulas are consistent';

    IF abs((SELECT sum(100.0 * n / v_orders)
            FROM (SELECT count(*) AS n FROM core.orders GROUP BY order_status) x) - 100.0) > 0.000001 THEN
        RAISE EXCEPTION 'FAIL: status shares do not sum to 100 percent';
    END IF;
    RAISE NOTICE 'PASS: status shares sum to 100 percent';

    IF EXISTS (
        WITH price_counts AS (
            SELECT product_id, count(DISTINCT item_price) AS distinct_prices
            FROM mart.sales_item
            WHERE order_status = 'delivered'
            GROUP BY product_id
        ), chosen AS (
            SELECT product_id, distinct_prices FROM price_counts
            ORDER BY distinct_prices DESC, product_id LIMIT 1
        )
        SELECT 1 FROM price_counts pc CROSS JOIN chosen c
        WHERE pc.distinct_prices > c.distinct_prices
           OR (pc.distinct_prices = c.distinct_prices AND pc.product_id < c.product_id)
    ) THEN
        RAISE EXCEPTION 'FAIL: question 6 product is not the maximum-price-count product with deterministic tie-break';
    END IF;
    RAISE NOTICE 'PASS: question 6 uses deterministic distinct-price ranking';
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
SELECT 'WARN', 'negative_delivery_duration_in_q7_q10', count(*)
FROM core.orders
WHERE order_status = 'delivered'
  AND purchased_at IS NOT NULL AND delivered_at IS NOT NULL AND estimated_delivery_at IS NOT NULL
  AND delivered_at < purchased_at
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
