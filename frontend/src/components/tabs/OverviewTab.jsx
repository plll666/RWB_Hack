import KpiCard from '../KpiCard.jsx';
import LineChart from '../LineChart.jsx';
import Empty from '../Empty.jsx';
import { denominatorNote, fmtInt, fmtMillion, fmtMoney, fmtPct } from '../../lib/format.js';

const STATUS_TONES = {
  delivered: 'is-accent',
  shipped: 'is-accent',
  invoiced: 'is-mid',
  processing: 'is-mid',
  approved: 'is-mid',
  unavailable: 'is-faint',
  canceled: 'is-faint',
  created: 'is-faint',
};

/** Вкладка «Обзор»: KPI-полоса, помесячная динамика, статусы заказов. */
export default function OverviewTab({ data }) {
  if (!data) return null;

  const { kpi, on_time, monthly, statuses } = data;

  if (kpi.orders_total === 0) return <Empty>Нет данных.</Empty>;

  const cells = [
    {
      id: 'orders',
      label: 'Заказы, шт',
      value: kpi.orders_total,
      format: fmtInt,
      sub: 'за выбранный период',
    },
    {
      id: 'revenue',
      label: 'Выручка (доставленные), R$',
      value: kpi.revenue,
      format: fmtMoney,
      sub: 'сумма товарных позиций',
    },
    {
      id: 'avg',
      label: 'Средний чек, R$',
      value: kpi.avg_ticket,
      format: fmtMoney,
      sub: 'доставленные заказы с позициями',
    },
    {
      id: 'ontime',
      label: 'В срок, %',
      value: on_time.share === null ? null : on_time.share * 100,
      format: (v) => (v === null ? '—' : fmtPct(on_time.share)),
      sub: `из ${fmtInt(on_time.n_orders)} доставленных · ${fmtInt(on_time.on_time_orders)} шт`,
    },
  ];

  return (
    <>
      <div className="strip is-4">
        {cells.map((c) => (
          <KpiCard key={c.id} kpi={c} />
        ))}
      </div>

      <div className="grid-main">
        <LineChart data={monthly}
          note={`окт 2018 и далее — снимок неполный · всего месяцев: ${monthly.length}`} />
        <div className="panel status-panel">
          <div className="panel-h">
            <h3 className="panel-title">Статусы заказов</h3>
            <span className="panel-note">{fmtInt(kpi.orders_total)} заказов</span>
          </div>
          <div className="status-list">
            {statuses.map((s) => (
              <div className="status-row" key={s.status}>
                <span className="status-label">{s.status}</span>
                <div className="status-track">
                  <div
                    className={`status-fill ${STATUS_TONES[s.status] ?? 'is-faint'}`}
                    style={{ '--w': `${(s.share * 100).toFixed(2)}%` }}
                  />
                </div>
                <span className="status-value">
                  {fmtPct(s.share)}<br />
                  <small className="is-muted">{fmtInt(s.orders)} шт</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="delivery-section">
        <div className="section-h">
          <h3>Справка по методике</h3>
          <span className="panel-note">в срок = delivered_at ≤ estimated_delivery_at</span>
        </div>
        <p className="explain">
          Выручка — сумма merchandise_value по <b>доставленным</b> заказам; средний чек —
          среднее full_ticket таких заказов. Доля «в срок» по определению из{' '}
          <b>docs/metric_definitions.md</b>: {denominatorNote(on_time.n_orders)}.
          Опоздание фиксируется по календарным датам, а не по точности часов.
        </p>
      </section>
    </>
  );
}
