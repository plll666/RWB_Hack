import { statuses, delivery, categories } from '../data.js';

function StatusBars() {
  return (
    <div className="panel status-panel">
      <div className="panel-h">
        <h3 className="panel-title">Статусы заказов</h3>
        <span className="panel-note">99 447 заказов</span>
      </div>
      <div className="status-list">
        {statuses.map((s) => (
          <div className="status-row" key={s.label}>
            <span className="status-label">{s.label}</span>
            <div className="status-track">
              <div
                className={`status-fill is-${s.tone}`}
                style={{ '--w': `${s.value}%` }}
              />
            </div>
            <span className="status-value">{s.value.toLocaleString('ru-RU')} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeliveryBlock() {
  return (
    <section className="delivery-section">
      <div className="section-h">
        <h3>Сроки и опоздания доставки</h3>
        <span className="panel-note">расчёт — core</span>
      </div>
      <div className="strip is-5">
        {delivery.map((d) => (
          <div className="strip-cell" key={d.label}>
            <p className="metric-label">{d.label}</p>
            <p className="metric-value" style={{ fontSize: 18 }}>{d.value}</p>
            <p className="metric-sub">{d.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryTable() {
  const nfInt = new Intl.NumberFormat('ru-RU');
  const nfDec = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className="panel">
      <div className="panel-h">
        <h3 className="panel-title">Категории</h3>
        <span className="panel-note">товарная выручка, доставленные</span>
      </div>
      <table className="cat-table">
        <thead>
          <tr>
            <th>Категория</th>
            <th className="is-num">Выручка, млн ₽</th>
            <th className="is-num">Заказы</th>
            <th className="is-num">Ср. чек, ₽</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr className="cat-row" key={c.name}>
              <td>{c.name}</td>
              <td className="is-num is-accent-text">{nfDec.format(c.revenue)}</td>
              <td className="is-num is-muted">{nfInt.format(c.orders)}</td>
              <td className="is-num is-muted">{nfInt.format(c.avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { StatusBars, DeliveryBlock, CategoryTable };
