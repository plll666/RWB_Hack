import { useEffect, useState } from 'react';
import Empty from '../Empty.jsx';
import Bars from '../Bars.jsx';
import IdCode from '../IdCode.jsx';
import { fetchChampion, fetchProduct } from '../../api.js';
import { fmtInt, fmtPct, fmtPrice } from '../../lib/format.js';

/** Вкладка «Категории и продавцы» — вопросы про категории, продавцов, цены (6). */
export default function CategoriesTab({ data, filter, local, onLocal, champion }) {
  if (!data) return null;
  const { categories, sellers, options } = data;
  const empty =
    categories.length === 0 &&
    sellers.length === 0;

  return (
    <>
      {/* Наглядные топы выручки — в самом верху вкладки */}
      <TopBars categories={categories} sellers={sellers} />

      {/* Локальные фильтры — работают только внутри этой вкладки */}
      <div className="filterbar" aria-label="Локальные фильтры вкладки">
        <div className="filterbar-group">
          <span className="filterbar-label">Категория</span>
          <details className="dropdown">
            <summary className={`dropdown-summary${local.categoryIds.length ? ' is-active' : ''}`}>
              {local.categoryIds.length === 0
                ? 'любые'
                : `${local.categoryIds.length} выбрано`}{' '}
              ▾
            </summary>
            <div className="dropdown-body">
              {options.map((o) => (
                <label className="dropdown-item" key={o.category_id}>
                  <input
                    type="checkbox"
                    checked={local.categoryIds.includes(o.category_id)}
                    onChange={() => {
                      const has = local.categoryIds.includes(o.category_id);
                      onLocal({
                        ...local,
                        categoryIds: has
                          ? local.categoryIds.filter((c) => c !== o.category_id)
                          : [...local.categoryIds, o.category_id],
                      });
                    }}
                  />
                  <span>{o.category_id}
                    {o.category_en && o.category_en !== o.category_id && (
                      <small className="is-muted"> · {o.category_en}</small>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <label className="filterbar-group">
          <span className="filterbar-label">Продавец (ID)</span>
          <input
            className="mini-input"
            placeholder="полный seller_id или пусто — все"
            value={local.sellerId}
            onChange={(e) => onLocal({ ...local, sellerId: e.target.value.trim() })}
          />
        </label>
      </div>

      {empty ? (
        <Empty>Нет данных на выбранном срезе.</Empty>
      ) : (
        <div className="grid-main is-2col">
          <div className="panel cat-panel">
            <div className="panel-h">
              <h3 className="panel-title">Категории</h3>
              <span className="panel-note">{categories.length} категорий</span>
            </div>
            <div className="table-scroll">
            <table className="cat-table">
              <thead>
                <tr>
                  <th>ID категории</th>
                  <th className="is-num">Заказы</th>
                  <th className="is-num">Товаров</th>
                  <th className="is-num">Выручка</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.category_id}>
                    <td>
                      <b>{c.category_id}</b>
                      <br />
                      <small className="is-muted">{c.category_en}</small>
                    </td>
                    <td className="is-num">{fmtInt(c.orders)}</td>
                    <td className="is-num">{fmtInt(c.items)}</td>
                    <td className="is-num is-accent-text">{fmtPrice(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="panel cat-panel">
            <div className="panel-h">
              <h3 className="panel-title">Продавцы</h3>
              <span className="panel-note">{sellers.length} продавцов</span>
            </div>
            <div className="table-scroll">
            <table className="cat-table">
              <thead>
                <tr>
                  <th>ID продавца</th>
                  <th>Штат</th>
                  <th className="is-num">Заказы</th>
                  <th className="is-num">Выручка</th>
                </tr>
              </thead>
              <tbody>
                {sellers.slice(0, 50).map((s) => (
                  <tr key={s.seller_id}>
                    <td><IdCode value={s.seller_id} /></td>
                    <td className="nowrap">{s.seller_state}</td>
                    <td className="is-num">{fmtInt(s.orders)}</td>
                    <td className="is-num is-accent-text">{fmtPrice(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="explain" style={{ padding: '10px 14px' }}>
              Показаны первые 50 из {sellers.length} — ID копируются кнопкой.
            </p>
          </div>
        </div>
      )}

      <ProductHistory filter={filter} local={local} champion={champion} />
    </>
  );
}

/** Наглядные топы по выручке — полосы относительны максимуму списка. */
function TopBars({ categories, sellers }) {
  const catItems = categories.slice(0, 10).map((c) => ({
    label: c.category_id,
    value: Number(c.revenue),
    text: fmtPrice(c.revenue),
    sub: `${fmtInt(c.orders)} заказов · ${fmtInt(c.items)} позиций`,
    title: c.category_en ? `${c.category_id} = ${c.category_en}` : c.category_id,
  }));
  const sellItems = sellers.slice(0, 10).map((s) => ({
    label: `${s.seller_id.slice(0, 10)}…`,
    value: Number(s.revenue),
    text: fmtPrice(s.revenue),
    sub: `${s.seller_state} · ${fmtInt(s.orders)} заказов`,
    title: s.seller_id,
  }));

  return (
    <div className="grid-main is-2col">
      <div className="panel status-panel">
        <div className="panel-h">
          <h3 className="panel-title">Топ-10 категорий по выручке</h3>
          <span className="panel-note">доставленные · полоса к максимуму</span>
        </div>
        {catItems.length === 0 ? (
          <Empty>Нет данных на выбранном срезе.</Empty>
        ) : (
          <Bars mode="max" items={catItems} tone="is-accent" />
        )}
      </div>
      <div className="panel status-panel">
        <div className="panel-h">
          <h3 className="panel-title">Топ-10 продавцов по выручке</h3>
          <span className="panel-note">ID обрезаны · полное значение в таблице</span>
        </div>
        {sellItems.length === 0 ? (
          <Empty>Нет данных на выбранном срезе.</Empty>
        ) : (
          <Bars mode="max" items={sellItems} tone="is-mid" />
        )}
      </div>
    </div>
  );
}

/** Вопрос 6: чемпион по количеству разных цен + история цен по датам. */
function ProductHistory({ filter, local, champion }) {
  const [input, setInput] = useState(champion?.product_id ?? '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!champion?.product_id) return;
    setInput(champion.product_id);
    load(champion.product_id);
    // Дефолтный чемпион подставляется один раз, дальше — руками пользователя.
  }, [champion?.product_id]);

  const load = async (pid) => {
    if (!pid) return;
    setError(null);
    try {
      setResult(await fetchProduct(pid, filter, local));
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  };

  const refresh = () => load(input);

  return (
    <section className="delivery-section">
      <div className="section-h">
        <h3>История цен товара</h3>
        {champion && (
          <span className="panel-note">
            дефолт — чемпион по разнообразию цен: {champion.n_prices} разных цен
          </span>
        )}
      </div>

      <div className="filterbar" aria-label="ID товара">
        <label className="filterbar-group">
          <span className="filterbar-label">product_id</span>
          <input
            className="mini-input"
            value={input}
            placeholder="32-символьный product_id"
            onChange={(e) => setInput(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && refresh()}
          />
          <button type="button" className="chip" onClick={refresh}>Показать</button>
        </label>
      </div>

      {error && (
        <Empty>
          Товар не найден на выбранном срезе: {error}
        </Empty>
      )}

      {result && (
        <div className="strip is-4">
          {/* Шаговая диаграмма: каждая точка — позиция товара в этот день */}
          <div style={{ gridColumn: '1 / -1' }}>
            <PriceChart history={result.history} />
          </div>
          <div className="strip-cell">
            <p className="metric-label">Товар</p>
            <p className="metric-value"><small>{result.product.category_en || '—'}</small></p>
            <p className="metric-sub"><IdCode value={result.product.product_id} /></p>
          </div>
          <div className="strip-cell">
            <p className="metric-label">Диапазон цен</p>
            <p className="metric-value">
              <small>{fmtPrice(result.product.min_price)} … {fmtPrice(result.product.max_price)}</small>
            </p>
            <p className="metric-sub">средняя {fmtPrice(result.product.avg_price)}</p>
          </div>
          <div className="strip-cell">
            <p className="metric-label">Разных цен</p>
            <p className="metric-value">{result.product.n_prices}</p>
            <p className="metric-sub">позиций: {fmtInt(result.product.items)}</p>
          </div>
          <div className="strip-cell">
            <p className="metric-label">Заказов с товаром</p>
            <p className="metric-value">{fmtInt(result.product.orders)}</p>
            <p className="metric-sub">строк истории: {result.history.length}</p>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div className="table-scroll">
            <table className="cat-table">
              <thead>
                <tr>
                  <th>Дата заказа</th>
                  <th className="is-num">Цена</th>
                  <th className="is-num">Позиций</th>
                </tr>
              </thead>
              <tbody>
                {result.history.slice(0, 30).map((h, i) => (
                  <tr key={`${h.date}-${h.price}-${i}`}>
                    <td className="nowrap">{h.date}</td>
                    <td className="is-num">{fmtPrice(h.price)}</td>
                    <td className="is-num">{fmtInt(h.items)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="explain" style={{ padding: '10px 14px' }}>
              Показаны первые 30 строк из {result.history.length}; повторяющиеся даты —
              разные цены в один день у одного и того же товара.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/** Цена товара по датам: политы позиций в тот же день дают «ступени». */
function PriceChart({ history }) {
  if (!history || history.length < 2) return null;

  const W = 760, H = 150, L = 56, R = 14, T = 12, B = 24;
  const innerW = W - L - R, innerH = H - T - B;

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  const xAt = (i) => L + (innerW * i) / (history.length - 1);
  const yAt = (p) => T + innerH - (innerH * (p - min)) / span;

  const path = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(h.price)}`)
    .join(' ');

  const xStep = Math.max(1, Math.ceil((history.length - 1) / 5));
  const xTicks = history
    .map((h, i) => ({ i, date: h.date }))
    .filter(({ i }) => i === 0 || i === history.length - 1 || i % xStep === 0);
  const yTicks = [min, (min + max) / 2, max].map((p) =>
    Number.isInteger(p) ? p : Math.round(p * 100) / 100,
  );

  return (
    <div className="panel">
      <div className="panel-h">
        <h3 className="panel-title">Цена по заказам, R$</h3>
        <span className="panel-note">
          {history.length} строк дата/цена · повторяющаяся дата — разные цены в
          один день (см. таблицу ниже)
        </span>
      </div>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="История цен товара"
        style={{ width: '100%' }}
      >
        {yTicks.map((v, k) => (
          <g key={k}>
            <line
              className="chart-grid"
              x1={L}
              x2={W - R}
              y1={yAt(v)}
              y2={yAt(v)}
            />
            <text className="chart-axis" x={L - 7} y={yAt(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={t.i}
            className="chart-axis"
            x={xAt(t.i)}
            y={H - 8}
            textAnchor="middle"
          >
            {t.date.slice(2)}
          </text>
        ))}
        <path d={path} className="chart-path" pathLength="1" />
      </svg>
    </div>
  );
}
