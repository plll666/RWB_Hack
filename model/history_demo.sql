-- Demonstrate changing a product category and a customer's address without
-- changing the historical values already attached to an existing order.
-- The transaction is always rolled back; this script leaves no demo data.
BEGIN;

CREATE TEMP TABLE history_demo_keys ON COMMIT DROP AS
SELECT o.order_id,
       oi.order_item_id,
       oi.product_id,
       oi.category_id AS old_category_id,
       o.customer_id,
       o.address_version_id AS old_address_version_id
FROM core.orders o
JOIN core.order_item oi USING (order_id)
WHERE o.purchased_at IS NOT NULL
ORDER BY o.purchased_at, o.order_id, oi.order_item_id
LIMIT 1;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM history_demo_keys) THEN
        RAISE EXCEPTION 'No order item available for the history demonstration';
    END IF;
END $$;

-- Close the current versions, then add a changed category and address.
UPDATE core.product_category_version v
SET valid_to = now()
FROM history_demo_keys k
WHERE v.product_id = k.product_id
  AND v.valid_from <= now() AND now() < v.valid_to;

INSERT INTO core.product_category_version (product_id, category_id, valid_from, valid_to)
SELECT k.product_id,
       (SELECT category_id FROM core.product_category c
        WHERE c.category_id <> k.old_category_id ORDER BY c.category_id LIMIT 1),
       now(), 'infinity'
FROM history_demo_keys k;

UPDATE core.product p
SET category_id = v.category_id
FROM core.product_category_version v
JOIN history_demo_keys k USING (product_id)
WHERE p.product_id = v.product_id
  AND v.valid_from = now();

UPDATE core.customer_address_version v
SET valid_to = now()
FROM history_demo_keys k
WHERE v.address_version_id = k.old_address_version_id;

INSERT INTO core.customer_address_version
    (customer_id, postal_prefix, city, state_code, valid_from, valid_to)
SELECT v.customer_id, v.postal_prefix, v.city || ' (demo move)', v.state_code,
       now(), 'infinity'
FROM core.customer_address_version v
JOIN history_demo_keys k ON k.old_address_version_id = v.address_version_id;

-- These rows must still show the original category and address version.
SELECT k.order_id,
       oi.category_id AS preserved_order_category_id,
       k.old_category_id AS original_category_id,
       o.address_version_id AS preserved_order_address_version_id,
       k.old_address_version_id AS original_address_version_id,
       old_address.city AS preserved_order_city,
       current_address.city AS current_demo_city,
       p.category_id AS current_demo_category_id,
       (oi.category_id = k.old_category_id) AS category_unchanged,
       (o.address_version_id = k.old_address_version_id) AS address_unchanged
FROM history_demo_keys k
JOIN core.order_item oi USING (order_id, order_item_id)
JOIN core.orders o USING (order_id)
JOIN core.customer_address_version old_address ON old_address.address_version_id = k.old_address_version_id
JOIN core.customer_address_version current_address
  ON current_address.customer_id = k.customer_id AND current_address.valid_from = now()
JOIN core.product p ON p.product_id = k.product_id;

ROLLBACK;
