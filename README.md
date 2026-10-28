# Кейс «Модель маркетплейса: от корзины до выкупа»

Окружение и раздаточный материал для команд. Вам предстоит спроектировать
модель данных маркетплейса, наполнить её из сырой выгрузки и ответить
SQL-запросами на вопросы аналитиков.

Данные — [Brazilian E-Commerce Public Dataset by Olist](https://github.com/olist/work-at-olist-data),
550 759 строк в восьми файлах, период с сентября 2016 по октябрь 2018.

## Быстрый старт

```bash
bash scripts/setup.sh
```

Скрипт проверяет Docker, поднимает PostgreSQL, скачивает данные, создаёт
схемы и загружает 550 759 строк в схему `raw`. На каждом шаге проверяет
результат и при сбое объясняет, что чинить. Занимает меньше минуты.

Начать с чистого листа: `bash scripts/setup.sh --reset`

Подключение: `postgresql://hack:hack@localhost:5432/marketplace`

## Сборка модели

Формулы и правила расчётов собраны в [описании модели](docs/model.md). После загрузки `raw` выполните сборку, проверки и запросы ответов из кейса:

```bash
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/build.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/checks.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/answers.sql
```

Скрипт модели можно запускать повторно: он пересоздаёт только таблицы в `core`, не меняя `raw`. `checks.sql` завершится ошибкой при нарушении блокирующей проверки (`FAIL`, при `ON_ERROR_STOP=1`) и выведет отдельные предупреждения качества (`WARN`). Запросы и контрольные результаты приведены в [ответах на вопросы](docs/answers.md).

### Полный цикл на чистой базе и повторная сборка

```bash
bash scripts/setup.sh --reset
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/build.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/checks.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/answers.sql

docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/build.sql
docker exec -i hack_postgres psql -U hack -d marketplace -v ON_ERROR_STOP=1 -f - < model/checks.sql
```

**Важно:** `--reset` удаляет Docker volume `pgdata` вместе с базой. Перед запуском убедитесь, что там нет данных, которые нужно сохранить.

## С чего начать

1. [docs/handout.md](docs/handout.md) — задание, описание данных и что сдавать.
2. [docs/tasks.md](docs/tasks.md) — вопросы, на которые должна отвечать
   ваша модель.

Вопросов в файле пять, но это не весь список: ещё пять появятся там же
в середине хакатона. Заранее их нет намеренно.

## Структура

```
.
├── README.md                     этот файл
├── docker-compose.yml            PostgreSQL 16, порт 5432
│
├── docs/
│   ├── handout.md                задание и описание данных
│   ├── tasks.md                  вопросы к модели
│   ├── model.md                  схема, гранулярность и контракт метрик
│   ├── answers.md                запросы и контрольные результаты
│   ├── solution_notes.md         краткая записка о решениях
│   ├── dashboard_concept.md      концепция дашборда
│   ├── development_strategy.md   стратегия развития
│   └── defense_guide.md          сценарий защиты
│
├── model/
│   ├── build.sql                 сборка core из raw
│   ├── checks.sql                блокирующие проверки и WARN-диагностика
│   └── answers.sql               ответы на вопросы кейса
│
├── scripts/
│   ├── setup.sh                  установка окружения целиком
│   ├── download_data.sh          скачивание CSV из репозитория Olist
│   ├── load_raw.py               загрузка CSV в схему raw
│   └── init/
│       ├── 01_init.sql           схемы raw, core, mart
│       └── 02_raw_ddl.sql        таблицы raw-слоя
│
└── data/                         исходные CSV, 61 МБ (скачиваются скриптом)
```

Свои скрипты складывайте рядом — например, в папку `model/`. Главное,
чтобы модель собиралась из `raw` одним запуском и на чистой базе.

## Схемы в базе

- `raw` — исходные данные как есть, все колонки `text`. Менять не нужно.
- `core` — ваша модель. Основное место работы.
- `mart` — витрины и сохранённые ответы, если понадобятся.

Все колонки в `raw` объявлены как `text` намеренно: в raw-слой данные
кладут в том виде, в каком они пришли. Объяви дату как `timestamp` —
и одно пустое значение уронит загрузку целиком. Приведение типов
и чистка это уже работа по переносу в свою модель.

## Требования к окружению

Docker Desktop или Docker Engine с плагином compose. Python 3.10+
с пакетом `psycopg2-binary` — `setup.sh` поставит его сам, если нет.
SQL-клиент по вкусу: DBeaver, psql внутри контейнера или веб-клиент
pgAdmin (`docker compose --profile tools up -d`, потом
http://localhost:8080).

Логин и пароль `hack` / `hack` простые намеренно, это локальная
учебная база.

## Если что-то не работает

**Схем raw, core и mart нет в базе.** Скрипты из `scripts/init`
выполняются только при создании пустой базы. Если база уже была создана
раньше, схемы не появятся сколько ни перезапускай контейнер. Лечится:
`bash scripts/setup.sh --reset`

**DBeaver не показывает схемы, хотя скрипт отработал.** Кэш дерева.
Правый клик по соединению → Disconnect, потом подключиться заново.

**Порт 5432 занят.** Поменяйте проброс в `docker-compose.yml`
на `"5433:5432"` и запустите `bash scripts/setup.sh --reset`.

**`docker compose up` будто завис.** Образ pgAdmin весит около 400 МБ.
Он вынесен в профиль `tools` и по умолчанию не запускается — поднимайте
базу через `setup.sh`.

**Загрузка падает на `ModuleNotFoundError: psycopg2`.** Поставьте вручную:
`pip install psycopg2-binary`
