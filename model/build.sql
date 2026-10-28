-- Build a typed, documented core model from the immutable raw layer.
-- Safe to rerun: only objects owned by this model are replaced.
BEGIN;
CREATE SCHEMA IF NOT EXISTS core;

DROP TABLE IF EXISTS core.order_review CASCADE;
DROP TABLE IF EXISTS core.order_payment CASCADE;
DROP TABLE IF EXISTS core.order_item CASCADE;
DROP TABLE IF EXISTS core.orders CASCADE;
DROP TABLE IF EXISTS core.product CASCADE;
DROP TABLE IF EXISTS core.seller CASCADE;
DROP TABLE IF EXISTS core.customer_record CASCADE;
DROP TABLE IF EXISTS core.buyer CASCADE;
DROP TABLE IF EXISTS core.product_category CASCADE;

-- Stable buyer identity. customer_id in raw is an order-scoped customer
-- record; customer_unique_id is the identity that persists across orders.
CREATE TABLE core.buyer (
    buyer_id text PRIMARY KEY
);
INSERT INTO core.buyer (buyer_id)
SELECT DISTINCT customer_unique_id FROM raw.customers
WHERE customer_unique_id IS NOT NULL;

-- Preserve each source customer record and its location; do not collapse
-- locations belonging to the same enduring buyer.
CREATE TABLE core.customer_record (
    customer_id text PRIMARY KEY,
    buyer_id text NOT NULL REFERENCES core.buyer(buyer_id),
    postal_prefix text,
    city text,
    state_code text
);
INSERT INTO core.customer_record
SELECT customer_id, customer_unique_id,
       customer_zip_code_prefix, customer_city, customer_state
FROM raw.customers;

CREATE TABLE core.seller (
    seller_id text PRIMARY KEY,
    postal_prefix text,
    city text,
    state_code text
);
INSERT INTO core.seller
SELECT seller_id, seller_zip_code_prefix, seller_city, seller_state
FROM raw.sellers;

-- Preserve untranslated category codes individually and map only truly
-- missing source categories to the explicit sentinel.
CREATE TABLE core.product_category (
    category_id text PRIMARY KEY,
    category_label text NOT NULL,
    category_label_english text
);
INSERT INTO core.product_category (category_id, category_label, category_label_english)
SELECT category_id,
       CASE WHEN category_id = '__UNCLASSIFIED__' THEN 'Unclassified' ELSE category_id END,
       CASE WHEN category_id = '__UNCLASSIFIED__' THEN 'Unclassified'
            ELSE COALESCE(t.product_category_name_english, category_id) END
FROM (
    SELECT product_category_name AS category_id
    FROM raw.products WHERE product_category_name IS NOT NULL
    UNION
    SELECT '__UNCLASSIFIED__'
) c
LEFT JOIN raw.product_category_translation t
       ON t.product_category_name = c.category_id;

CREATE TABLE core.product (
    product_id text PRIMARY KEY,
    category_id text NOT NULL REFERENCES core.product_category(category_id),
    name_length integer,
    description_length integer,
    photos_qty integer,
    weight_g integer,
    length_cm numeric(10,2),
    height_cm numeric(10,2),
    width_cm numeric(10,2)
);
INSERT INTO core.product
SELECT p.product_id,
       COALESCE(p.product_category_name, '__UNCLASSIFIED__'),
       NULLIF(p.product_name_lenght, '')::integer,
       NULLIF(p.product_description_lenght, '')::integer,
       NULLIF(p.product_photos_qty, '')::integer,
       NULLIF(p.product_weight_g, '')::integer,
       NULLIF(p.product_length_cm, '')::numeric(10,2),
       NULLIF(p.product_height_cm, '')::numeric(10,2),
       NULLIF(p.product_width_cm, '')::numeric(10,2)
FROM raw.products p;

CREATE TABLE core.orders (
    order_id text PRIMARY KEY,
    customer_id text NOT NULL REFERENCES core.customer_record(customer_id),
    order_status text NOT NULL,
    purchased_at timestamp,
    approved_at timestamp,
    handed_to_carrier_at timestamp,
    delivered_at timestamp,
    estimated_delivery_at timestamp
);
INSERT INTO core.orders
SELECT order_id, customer_id, order_status,
       NULLIF(order_purchase_timestamp, '')::timestamp,
       NULLIF(order_approved_at, '')::timestamp,
       NULLIF(order_delivered_carrier_date, '')::timestamp,
       NULLIF(order_delivered_customer_date, '')::timestamp,
       NULLIF(order_estimated_delivery_date, '')::timestamp
FROM raw.orders;

-- Grain: one product/seller position within an order. order_item_id is a
-- position number, not a globally unique item ID.
CREATE TABLE core.order_item (
    order_id text NOT NULL REFERENCES core.orders(order_id),
    order_item_id integer NOT NULL,
    product_id text NOT NULL REFERENCES core.product(product_id),
    seller_id text NOT NULL REFERENCES core.seller(seller_id),
    shipping_limit_at timestamp,
    item_price numeric(12,2) NOT NULL,
    freight_value numeric(12,2) NOT NULL,
    PRIMARY KEY (order_id, order_item_id)
);
INSERT INTO core.order_item
SELECT order_id, order_item_id::integer, product_id, seller_id,
       NULLIF(shipping_limit_date, '')::timestamp,
       price::numeric(12,2), freight_value::numeric(12,2)
FROM raw.order_items;

-- A single order can have several payment rows.
CREATE TABLE core.order_payment (
    order_id text NOT NULL REFERENCES core.orders(order_id),
    payment_sequential integer NOT NULL,
    payment_type text,
    installments integer,
    payment_value numeric(12,2) NOT NULL,
    PRIMARY KEY (order_id, payment_sequential)
);
INSERT INTO core.order_payment
SELECT order_id, payment_sequential::integer, payment_type,
       NULLIF(payment_installments, '')::integer,
       payment_value::numeric(12,2)
FROM raw.order_payments;

-- review_id is not unique in the source (some IDs are reused across orders).
-- Keep every source row with a generated technical key; do not deduplicate.
CREATE TABLE core.order_review (
    review_row_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_review_id text NOT NULL,
    order_id text NOT NULL REFERENCES core.orders(order_id),
    review_score smallint,
    comment_title text,
    comment_message text,
    created_at timestamp,
    answered_at timestamp
);
INSERT INTO core.order_review
    (source_review_id, order_id, review_score, comment_title,
     comment_message, created_at, answered_at)
SELECT review_id, order_id, NULLIF(review_score, '')::smallint,
       review_comment_title, review_comment_message,
       NULLIF(review_creation_date, '')::timestamp,
       NULLIF(review_answer_timestamp, '')::timestamp
FROM raw.order_reviews;

CREATE INDEX orders_purchased_at_idx ON core.orders(purchased_at);
CREATE INDEX orders_customer_id_idx ON core.orders(customer_id);
CREATE INDEX order_item_product_id_idx ON core.order_item(product_id);
CREATE INDEX order_item_seller_id_idx ON core.order_item(seller_id);
CREATE INDEX order_review_order_id_idx ON core.order_review(order_id);

COMMIT;
