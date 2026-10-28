#!/usr/bin/env bash
# Скачивает исходные CSV в папку data.
# Источник: официальный репозиторий Olist на GitHub.
#
# Запуск из корня проекта:  bash scripts/download_data.sh

set -euo pipefail

BASE="https://raw.githubusercontent.com/olist/work-at-olist-data/master/datasets"
# Скрипт лежит в scripts/, данные — в data/ рядом с ним на уровень выше.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"

FILES=(
  olist_orders_dataset.csv
  olist_order_items_dataset.csv
  olist_order_payments_dataset.csv
  olist_order_reviews_dataset.csv
  olist_products_dataset.csv
  olist_sellers_dataset.csv
  olist_customers_dataset.csv
  product_category_name_translation.csv
)

mkdir -p "$DIR"

for f in "${FILES[@]}"; do
  if [ -s "$DIR/$f" ]; then
    if python3 - "$DIR/$f" <<'PY'
import csv, sys
with open(sys.argv[1], encoding="utf-8-sig", newline="") as stream:
    rows = csv.reader(stream)
    header = next(rows, None)
    if not header or sum(1 for _ in rows) == 0:
        raise SystemExit(1)
PY
    then
      echo "уже есть: $f"
      continue
    fi
    rm -f "$DIR/$f"
  fi
  echo "качаю:    $f"
  tmp="$DIR/$f.part"
  rm -f "$tmp"
  if curl -fsSL --retry 3 -o "$tmp" "$BASE/$f"; then
    mv "$tmp" "$DIR/$f"
  else
    rm -f "$tmp"
    exit 1
  fi
done

echo
echo "Готово. Файлы в $DIR"
du -sh "$DIR"
