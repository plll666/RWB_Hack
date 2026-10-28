import Empty from '../Empty.jsx';
import { fmtInt } from '../../lib/format.js';

/** Вкладка «Качество данных» — диагностика, а не расчёт: ПАСС/ВАРН объясняются. */
export default function QualityTab({ data }) {
  if (!data) return null;
  const { snapshot, counts, missing, orders_without_items, payment_mismatch } = data;

  const countsGrid = [
    ['Заказы', counts.orders],
    ['Покупатели (уникальные)', counts.buyers],
    ['Записи покупателей', counts.customer_records],
    ['Версии категорий', counts.category_versions],
    ['Версии адресов', counts.address_versions],
    ['Товары', counts.products],
    ['Категории', counts.categories],
    ['Продавцы', counts.sellers],
    ['Позиции заказов', counts.items],
    ['Платежи', counts.payments],
    ['Отзывы', counts.reviews],
  ];

  return (
    <>
      <section className="delivery-section">
        <div className="section-h">
          <h3>Снимок данных</h3>
          <span className="panel-note">
            Исторические данные: {snapshot.from} … {snapshot.to}
          </span>
        </div>
        <p className="explain">
          Снимок — границы фактических заказов в витрине mart.order_sales. Октябрь 2018
          входит частично: полные месяцы корректны, последний месяц не полноправный
          (нет части наблюдений).
        </p>

        <div className="quality-grid">
          {countsGrid.map(([label, v]) => (
            <div className="quality-cell" key={label}>
              <p className="metric-label">{label}</p>
              <p className="metric-value"><small>{fmtInt(v)}</small></p>
            </div>
          ))}
        </div>
      </section>

      <section className="delivery-section">
        <div className="section-h">
          <h3>Пропуски и расхождения</h3>
          <span className="panel-note">{countsGrid.length} справочников выше</span>
        </div>

        <div className="quality-grid">
          <div className="quality-cell">
            <p className="metric-label">Доставка</p>
            <ul>
              <li>Заказы без даты покупки: <b>{fmtInt(missing.orders_without_purchase_date)}</b></li>
              <li>Доставленные без даты факта: <b>{fmtInt(missing.delivered_without_delivery_date)}</b></li>
              <li>Доставленные без обещанной даты: <b>{fmtInt(missing.delivered_without_estimated_date)}</b></li>
            </ul>
          </div>
          <div className="quality-cell">
            <p className="metric-label">Корзины и платежи</p>
            <ul>
              <li>Заказы без позиций: <b>{fmtInt(orders_without_items)}</b></li>
              <li>Расхождение платеж ↔ корзина (&gt;0,01 R$): <b>{fmtInt(payment_mismatch.mismatched_orders)}</b></li>
              <li>Корзины без платежей: <b>{fmtInt(payment_mismatch.basket_without_payment)}</b></li>
            </ul>
          </div>
        </div>

        <p className="explain">
          Все значения считаются SQL-запросами к core/mart в момент загрузки вкладки;
          констант в интерфейсе нет. Расхождение платежей считалось по определению из{' '}
          <b>model/checks.sql</b>: только заказы, у которых есть и корзина, и платежи.
          Метрики доставки на других вкладках всегда показывают знаменатель —
          доставленные заказы с полным набором дат (purchase / estimated / delivered).
        </p>
      </section>
    </>
  );
}
