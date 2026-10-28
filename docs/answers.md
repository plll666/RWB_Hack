# Ответы на первые пять вопросов кейса

Запросы и применённые определения находятся в [`model/answers.sql`](../model/answers.sql). Все результаты ниже получены его выполнением на `core` в PostgreSQL 16.

## 1. Выручка и число заказов по месяцам

> Выручка и число заказов по месяцам за период с сентября 2016 по август 2018.

Число заказов — все заказы по дате оформления независимо от статуса; выручка — сумма цены товаров (`item_price`) только для заказов со статусом `delivered`, без `freight_value`. Окно: `[2016-09-01, 2018-09-01)`. Календарь строится отдельно и включает месяцы без заказов.

| Месяц | Заказов | Выручка |
|---|---:|---:|
| 2016-09 | 4 | 134.97 |
| 2016-10 | 324 | 40 325.11 |
| 2016-11 | 0 | 0.00 |
| 2016-12 | 1 | 10.90 |
| 2017-01 | 800 | 111 798.36 |
| 2017-02 | 1 780 | 234 223.40 |
| 2017-03 | 2 682 | 359 198.85 |
| 2017-04 | 2 404 | 340 669.68 |
| 2017-05 | 3 700 | 489 338.25 |
| 2017-06 | 3 245 | 421 923.37 |
| 2017-07 | 4 026 | 481 604.52 |
| 2017-08 | 4 331 | 554 699.70 |
| 2017-09 | 4 285 | 607 399.67 |
| 2017-10 | 4 631 | 648 247.65 |
| 2017-11 | 7 544 | 987 765.37 |
| 2017-12 | 5 673 | 726 033.19 |
| 2018-01 | 7 269 | 924 645.00 |
| 2018-02 | 6 728 | 826 437.13 |
| 2018-03 | 7 211 | 953 356.25 |
| 2018-04 | 6 939 | 973 534.09 |
| 2018-05 | 6 873 | 977 544.69 |
| 2018-06 | 6 167 | 856 077.86 |
| 2018-07 | 6 292 | 867 953.46 |
| 2018-08 | 6 512 | 838 576.64 |
| **Итого** | **99 421** | **13 221 498.11** |

Контроль: 24 строки; ноябрь 2016 — нулевой месяц; сумма выручки совпала с **13 221 498.11**.

## 2. Топ-10 продавцов по выручке

> Топ-10 продавцов с указанием города и штата, числа заказов, единиц товара и выручки.

Выручка — только `item_price` позиций доставленных заказов. Число заказов считается как `count(distinct order_id)` на продавца. В исходнике нет отдельного поля количества, поэтому единицами считаются строки `order_item`.

| Продавец | Город | Штат | Заказы | Единиц/позиций | Выручка |
|---|---|:---:|---:|---:|---:|
| `4869f7a5dfa277a7dca6462dcf3b52b2` | guariba | SP | 1 124 | 1 148 | 226 987.93 |
| `53243585a1d6dc2643021fd1853d8905` | lauro de freitas | BA | 348 | 400 | 217 940.44 |
| `4a3ca9315b744ce9f8e9374361493884` | ibitinga | SP | 1 772 | 1 949 | 196 882.12 |
| `fa1c13f2614d7b5c4749cbc52fecda94` | sumare | SP | 578 | 579 | 190 917.14 |
| `7c67e1448b00f6e969d365cea6b010ab` | itaquaquecetuba | SP | 973 | 1 355 | 186 570.05 |
| `7e93a43ef30c4f03f38b393420bc753a` | barueri | SP | 319 | 322 | 165 981.49 |
| `da8622b14eb17ae2831f4ac5b9dab84a` | piracicaba | SP | 1 311 | 1 548 | 159 816.87 |
| `7a67c85e85bb2ce8582c35f2203ad736` | sao paulo | SP | 1 145 | 1 155 | 139 658.69 |
| `1025f0e2d44d7041d6cf58b6550e0bfa` | sao paulo | SP | 910 | 1 420 | 138 208.56 |
| `955fee9216a65b617aa5c0531780ce60` | sao paulo | SP | 1 261 | 1 472 | 131 836.71 |

Контроль: выручка лидера — **226 987.93**.

## 3. Средний чек заказа

> Средний чек заказа. Дополнительно — среднее число строк и единиц товара на заказ.

Сначала суммируем `item_price + freight_value` внутри каждого доставленного заказа, затем усредняем чеки между заказами. Это сохраняет уровень заказа; среднее по строкам дало бы другой результат. Строки позиции считаются единицами, поскольку количества в исходной схеме нет.

| Показатель | Значение |
|---|---:|
| Средний чек с доставкой | **159.88** |
| Среднее число строк позиции на заказ | **1.1422** |
| Среднее число единиц товара на заказ | **1.1422** |

Контроль среднего чека — **159.88**.

## 4. Покупатели и повторные покупки

> Сколько покупателей и сколько из них вернулись за второй покупкой.

Покупатель считается по постоянному ключу `core.buyer.buyer_id` (`customer_unique_id` из источника), не по `customer_id`, который относится к адресной/заказной записи.

| Показатель | Значение |
|---|---:|
| Покупателей | **96 096** |
| Вернулись (более одного заказа) | **2 997** |
| Доля повторных покупателей | **3.12%** |

## 5. Выручка по категориям товаров

> Выручка и доля каждой категории в общей выручке.

Сумма — `item_price` доставленных заказов; доставка исключена. Пустая категория показана как `Unclassified` с ключом `__UNCLASSIFIED__`. Категории без перевода сохранены раздельно под исходными ключами. Группировка в запросе выполняется по `category_id`, чтобы одинаковые подписи не слили разные категории.

| Ключ категории | Категория | Выручка | Доля |
|---|---|---:|---:|
| `beleza_saude` | health_beauty | 1 233 131.72 | 9.33% |
| `relogios_presentes` | watches_gifts | 1 166 176.98 | 8.82% |
| `cama_mesa_banho` | bed_bath_table | 1 023 434.76 | 7.74% |
| `esporte_lazer` | sports_leisure | 954 852.55 | 7.22% |
| `informatica_acessorios` | computers_accessories | 888 724.61 | 6.72% |
| `moveis_decoracao` | furniture_decor | 711 927.69 | 5.38% |
| `utilidades_domesticas` | housewares | 615 628.69 | 4.66% |
| `cool_stuff` | cool_stuff | 610 204.10 | 4.62% |
| `automotivo` | auto | 578 966.65 | 4.38% |
| `brinquedos` | toys | 471 286.48 | 3.56% |
| `ferramentas_jardim` | garden_tools | 470 495.28 | 3.56% |
| `bebes` | baby | 400 421.84 | 3.03% |
| `perfumaria` | perfumery | 390 144.65 | 2.95% |
| `telefonia` | telephony | 309 860.23 | 2.34% |
| `moveis_escritorio` | office_furniture | 268 154.31 | 2.03% |
| `papelaria` | stationery | 223 788.69 | 1.69% |
| `pcs` | computers | 218 684.14 | 1.65% |
| `pet_shop` | pet_shop | 211 695.64 | 1.60% |
| `instrumentos_musicais` | musical_instruments | 184 315.74 | 1.39% |
| `eletroportateis` | small_appliances | 182 754.12 | 1.38% |
| `__UNCLASSIFIED__` | Unclassified | 170 726.63 | 1.29% |
| `eletronicos` | electronics | 155 043.93 | 1.17% |
| `fashion_bolsas_e_acessorios` | fashion_bags_accessories | 149 329.39 | 1.13% |
| `consoles_games` | consoles_games | 148 003.37 | 1.12% |
| `construcao_ferramentas_construcao` | construction_tools_construction | 142 108.49 | 1.07% |
| `malas_acessorios` | luggage_accessories | 138 701.63 | 1.05% |
| `eletrodomesticos_2` | home_appliances_2 | 107 953.95 | 0.82% |
| `casa_construcao` | home_construction | 81 407.57 | 0.62% |
| `eletrodomesticos` | home_appliances | 78 832.48 | 0.60% |
| `agro_industria_e_comercio` | agro_industry_and_commerce | 70 566.10 | 0.53% |
| `moveis_sala` | furniture_living_room | 67 350.70 | 0.51% |
| `casa_conforto` | home_confort | 58 008.45 | 0.44% |
| `telefonia_fixa` | fixed_telephony | 55 315.21 | 0.42% |
| `climatizacao` | air_conditioning | 53 323.56 | 0.40% |
| `audio` | audio | 50 570.60 | 0.38% |
| `portateis_casa_forno_e_cafe` | small_appliances_home_oven_and_coffee | 46 589.56 | 0.35% |
| `moveis_cozinha_area_de_servico_jantar_e_jardim` | kitchen_dining_laundry_garden_furniture | 45 531.98 | 0.34% |
| `livros_interesse_geral` | books_general_interest | 45 302.15 | 0.34% |
| `construcao_ferramentas_iluminacao` | construction_tools_lights | 39 957.00 | 0.30% |
| `construcao_ferramentas_seguranca` | construction_tools_safety | 38 773.22 | 0.29% |
| `industria_comercio_e_negocios` | industry_commerce_and_business | 38 498.81 | 0.29% |
| `alimentos` | food | 28 731.15 | 0.22% |
| `market_place` | market_place | 27 795.77 | 0.21% |
| `construcao_ferramentas_jardim` | costruction_tools_garden | 25 096.28 | 0.19% |
| `artes` | art | 23 657.30 | 0.18% |
| `fashion_calcados` | fashion_shoes | 23 001.46 | 0.17% |
| `bebidas` | drinks | 21 529.84 | 0.16% |
| `sinalizacao_e_seguranca` | signaling_and_security | 21 315.05 | 0.16% |
| `moveis_quarto` | furniture_bedroom | 19 051.80 | 0.14% |
| `livros_tecnicos` | books_technical | 18 702.23 | 0.14% |
| `construcao_ferramentas_ferramentas` | costruction_tools_tools | 15 903.95 | 0.12% |
| `alimentos_bebidas` | food_drink | 14 942.88 | 0.11% |
| `fashion_roupa_masculina` | fashion_male_clothing | 10 452.33 | 0.08% |
| `fashion_underwear_e_moda_praia` | fashion_underwear_beach | 9 305.95 | 0.07% |
| `artigos_de_natal` | christmas_supplies | 8 737.84 | 0.07% |
| `tablets_impressao_imagem` | tablets_printing_image | 7 528.41 | 0.06% |
| `cine_foto` | cine_photo | 6 674.47 | 0.05% |
| `musica` | music | 6 034.35 | 0.05% |
| `dvds_blu_ray` | dvds_blu_ray | 4 542.59 | 0.03% |
| `artigos_de_festas` | party_supplies | 4 465.19 | 0.03% |
| `livros_importados` | books_imported | 4 418.86 | 0.03% |
| `moveis_colchao_e_estofado` | furniture_mattress_and_upholstery | 4 323.38 | 0.03% |
| `portateis_cozinha_e_preparadores_de_alimentos` | portateis_cozinha_e_preparadores_de_alimentos | 3 933.63 | 0.03% |
| `fashion_roupa_feminina` | fashio_female_clothing | 2 634.94 | 0.02% |
| `fashion_esporte` | fashion_sport | 2 094.52 | 0.02% |
| `la_cuisine` | la_cuisine | 2 054.99 | 0.02% |
| `artes_e_artesanato` | arts_and_craftmanship | 1 814.01 | 0.01% |
| `fraldas_higiene` | diapers_and_hygiene | 1 500.79 | 0.01% |
| `pc_gamer` | pc_gamer | 1 306.95 | 0.01% |
| `flores` | flowers | 1 110.04 | 0.01% |
| `casa_conforto_2` | home_comfort_2 | 760.27 | 0.01% |
| `cds_dvds_musicais` | cds_dvds_musicals | 730.00 | 0.01% |
| `fashion_roupa_infanto_juvenil` | fashion_childrens_clothes | 519.95 | 0.00% |
| `seguros_e_servicos` | security_and_services | 283.29 | 0.00% |
| **Итого** | **74 категории** | **13 221 498.11** | **100%*** |

Контроль: 74 категории; крупнейшая — `health_beauty`, **1 233 131.72**; сумма — **13 221 498.11**. `*` Доли округлены до сотых, поэтому сумма отображаемых долей может немного отличаться от 100%.
