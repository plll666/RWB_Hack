# Capibara: аналитика маркетплейса

Модель PostgreSQL для кейса Olist: неизменяемые `raw`, аналитический слой `core` и представления `mart`.

## Запуск

Нужны Docker Desktop и Bash (Git Bash или WSL). Из корня репозитория:

```bash
bash scripts/setup.sh
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/build.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/mart.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/checks.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/answers.sql
```

После проверок и ответов можно отдельно показать историчность модели:

```bash
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/history_demo.sql
```

Скрипт выбирает одну позицию и заказ, временно меняет текущую версию категории и адреса, показывает сохранённые исторические ссылки и завершает транзакцию через `ROLLBACK`. Он не оставляет изменений в базе.

Для повторной сборки без сброса БД повторите `build.sql`, затем `mart.sql`, `checks.sql` и `answers.sql` в том же порядке. `checks.sql` останавливается на нарушении инвариантов и отдельно выводит предупреждения о качестве данных.

Полный сброс выполняется командой `bash scripts/setup.sh --reset`; она удаляет Docker volume с базой.

## Дашборд

`dashboard-mock/` — статический прототип. Живой Streamlit-дашборд подключается к PostgreSQL через локальный `DATABASE_URL`; секреты нельзя коммитить. После добавления приложения запуск: `streamlit run dashboard/app.py`.

## Материалы

- [Раздаточный материал](docs/handout.md), [требования блока Б](docs/tasks.md)
- [Определения метрик](docs/metric_definitions.md), [ответы](docs/answers.md)
- `model/build.sql`, `model/mart.sql`, `model/checks.sql`, `model/answers.sql`, `model/history_demo.sql`
