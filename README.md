# Модель маркетплейса Capibara

SQL-модель PostgreSQL для анализа заказов, товаров, продавцов, оплат и покупателей на данных Olist.

## Быстрый запуск

Требуются Docker и Bash (Git Bash или WSL). Из корня репозитория:

```bash
bash scripts/setup.sh
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/build.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/checks.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/answers.sql
```

`build.sql` собирает схему `core` из исходной `raw`; `checks.sql` проверяет контрольные значения и показывает предупреждения о качестве данных; `answers.sql` выводит ответы на вопросы кейса.

Для пересоздания базы используйте `bash scripts/setup.sh --reset`. **Команда удаляет Docker volume с базой.**

Описание задания — [`docs/handout.md`](docs/handout.md), ответы и результаты — [`docs/answers.md`](docs/answers.md).
