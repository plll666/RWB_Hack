import Empty from '../Empty.jsx';
import Bars from '../Bars.jsx';
import { denominatorNote, fmtInt, fmtPct, fmtDays } from '../../lib/format.js';

/** Полоса из 4 ячеек — структурно как strip у мока. */
function SummaryCells({ summary }) {
  const cells = [
    { l: 'Доставлено заказов', v: fmtInt(summary.n_orders) },
    { l: 'Средний срок', v: fmtDays(summary.avg_days), s: `медиана ${fmtDays(summary.median_days)}` },
    { l: 'Опоздавших заказов', v: fmtInt(summary.late_orders) },
    { l: 'Доля опозданий', v: fmtPct(summary.late_share) },
  ];
  return (
    <div className="strip is-4">
      {cells.map((c) => (
        <div className="strip-cell" key={c.l}>
          <p className="metric-label">{c.l}</p>
          <p className="metric-value">{c.v}</p>
          {c.s && <p className="metric-sub">{c.s}</p>}
        </div>
      ))}
    </div>
  );
}

/** Вкладка «Доставка» — вопрос 7: сроки, штаты с порогом, оценки. */
export default function DeliveryTab({ data, minOrders, onMinOrders }) {
  if (!data) return null;
  const { summary, states, scores } = data;

  return (
    <>
      <section className="delivery-section">
        <div className="section-h">
          <h3>Сроки и опоздания доставки</h3>
          <span className="panel-note">{denominatorNote(summary.n_orders)}</span>
        </div>

        {summary.n_orders === 0 ? (
          <Empty>Нет данных на выбранном срезе.</Empty>
        ) : (
          <>
            <SummaryCells summary={summary} />

            <div className="grid-main">
              <div className="panel status-panel">
                <div className="panel-h">
                  <h3 className="panel-title">Опоздания по штатам покупателя</h3>
                  <span className="panel-note">
                    порог: не менее{' '}
                    <input
                      type="number"
                      className="datefield"
                      style={{ width: 76 }}
                      min="1"
                      max="20000"
                      value={minOrders}
                      onChange={(e) => onMinOrders(Math.max(1, Number(e.target.value) || 1))}
                    />{' '}
                    заказов
                  </span>
                </div>
                {states.length === 0 ? (
                  <Empty>Ни один штат не проходит порог {minOrders} заказов.</Empty>
                ) : (
                  <div className="status-list">
                    {states.map((s) => (
                      <div className="status-row" key={s.state}>
                        <span className="status-label">{s.state}</span>
                        <div
                          className="status-track"
                          title={`${fmtInt(s.n_orders)} заказов · средний срок ${fmtDays(s.avg_days)}`}
                        >
                          <div
                            className="status-fill is-accent"
                            style={{ '--w': `${(s.late_share * 100).toFixed(2)}%` }}
                          />
                        </div>
                        <span className="status-value">
                          {fmtPct(s.late_share)}
                          <br />
                          <small className="is-muted">{fmtInt(s.n_orders)} шт</small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="explain" style={{ padding: '10px 14px' }}>
                  Полоса — доля опозданий. Порог 500 задан условием (повторяет
                  официальную выборку вопроса 7); его можно менять — строки ниже порога
                  скрыты, а не обнулены.
                </p>
              </div>

              <div className="panel">
                <div className="panel-h">
                  <h3 className="panel-title">Оценки покупателей</h3>
                  <span className="panel-note">
                    ассоциируется оценка с доставкой, а не причинная связь
                  </span>
                </div>
                {scores.length === 0 ? (
                  <Empty>Нет данных на выбранном срезе.</Empty>
                ) : (
                  <div className="table-scroll">
                  <table className="cat-table scores-table">
                    <thead>
                      <tr>
                        <th>Оценка</th>
                        <th className="is-num">Заказы</th>
                        <th className="is-num">Срок</th>
                        <th className="is-num">Опоздания</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s) => (
                        <tr key={s.score}>
                          <td className="nowrap">
                            {'★'.repeat(s.score)}
                            <span className="is-muted">{'☆'.repeat(5 - s.score)}</span>
                          </td>
                          <td className="is-num">{fmtInt(s.n_orders)}</td>
                          <td className="is-num">{fmtDays(s.avg_days)}</td>
                          <td className="is-num is-accent-text">
                            {fmtInt(s.late_orders)}
                            <br />
                            <small className="is-muted">{fmtPct(s.late_share)}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
                {scores.length > 0 && (
                  <div style={{ padding: '14px 16px 8px' }}>
                    <p className="metric-label">Доля опозданий по оценке</p>
                    <Bars
                      mode="share"
                      items={scores.map((s) => ({
                        label: '★'.repeat(s.score),
                        value: s.late_share,
                        text: fmtPct(s.late_share),
                        sub: `${fmtInt(s.late_orders)} из ${fmtInt(s.n_orders)} заказов`,
                        title: `Оценка ${s.score}: средний срок ${fmtDays(s.avg_days)}`,
                      }))}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
