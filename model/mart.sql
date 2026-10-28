-- Rebuild lightweight analytical views over core. No copied or cached facts.
BEGIN;
CREATE SCHEMA IF NOT EXISTS mart;

CREATE OR REPLACE VIEW mart.order_sales AS
WITH item_totals AS (
    SELECT order_id,
           sum(item_price) AS merchandise_value,
           sum(freight_value) AS freight_value
    FROM core.order_item
    GROUP BY order_id
)
SELECT o.order_id,
       o.purchased_at::date AS order_date,
       o.order_status,
       av.state_code AS buyer_state,
       coalesce(it.merchandise_value, 0)::numeric(14,2) AS merchandise_value,
       coalesce(it.freight_value, 0)::numeric(14,2) AS freight_value,
       (coalesce(it.merchandise_value, 0) + coalesce(it.freight_value, 0))::numeric(14,2) AS full_ticket
FROM core.orders o
LEFT JOIN core.customer_address_version av USING (address_version_id)
LEFT JOIN item_totals it USING (order_id);

CREATE OR REPLACE VIEW mart.order_delivery AS
SELECT o.order_id,
       o.order_status,
       o.purchased_at,
       o.delivered_at,
       o.estimated_delivery_at,
       av.state_code AS buyer_state,
       CASE WHEN o.purchased_at IS NOT NULL AND o.delivered_at IS NOT NULL
            THEN extract(epoch FROM (o.delivered_at - o.purchased_at)) / 86400.0 END AS delivery_days,
       CASE WHEN o.delivered_at IS NOT NULL AND o.estimated_delivery_at IS NOT NULL
            THEN o.delivered_at::date > o.estimated_delivery_at::date END AS is_late,
       (o.purchased_at IS NOT NULL AND o.delivered_at IS NOT NULL
        AND o.estimated_delivery_at IS NOT NULL) AS has_complete_dates,
       EXISTS (SELECT 1 FROM core.order_item i WHERE i.order_id = o.order_id) AS has_items
FROM core.orders o
LEFT JOIN core.customer_address_version av USING (address_version_id);

CREATE OR REPLACE VIEW mart.sales_item AS
SELECT i.order_id,
       o.purchased_at::date AS order_date,
       o.order_status,
       i.order_item_id,
       i.product_id,
       i.category_id,
       c.category_label,
       c.category_label_english,
       i.seller_id,
       buyer_address.state_code AS buyer_state,
       s.state_code AS seller_state,
       i.item_price,
       i.freight_value
FROM core.order_item i
JOIN core.orders o USING (order_id)
JOIN core.product_category c ON c.category_id = i.category_id
JOIN core.seller s USING (seller_id)
JOIN core.customer_address_version buyer_address USING (address_version_id);

CREATE OR REPLACE VIEW mart.payment_fact AS
SELECT p.order_id,
       o.purchased_at::date AS order_date,
       av.state_code AS buyer_state,
       p.payment_sequential,
       p.payment_type,
       p.payment_value,
       p.installments
FROM core.order_payment p
JOIN core.orders o USING (order_id)
LEFT JOIN core.customer_address_version av USING (address_version_id);

CREATE OR REPLACE VIEW mart.review_order AS
WITH unique_order_scores AS (
    SELECT DISTINCT order_id, review_score
    FROM core.order_review
    WHERE review_score BETWEEN 1 AND 5
)
SELECT r.order_id,
       r.review_score,
       d.order_status,
       d.delivery_days,
       d.is_late,
       d.has_complete_dates
FROM unique_order_scores r
JOIN mart.order_delivery d USING (order_id);
COMMIT;
