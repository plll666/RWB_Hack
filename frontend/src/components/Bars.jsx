/**
 * Горизонтальные полосы в стиле мока (классы status-row/track/fill).
 * Переиспользуется вкладками: доли (mode='share') и абсолюты (mode='max').
 * items: [{ label, value, text, sub, title, tone? }]
 *   value — доля 0..1 для share, абсолют для max;
 *   text  — значение справа (уже отформатированное);
 *   sub   — вторая строка справа (пояснение/знаменатель).
 */
export default function Bars({ items, mode = 'share', tone = 'is-accent' }) {
  const max =
    Math.max(...items.map((i) => Number(i.value) || 0), 0) || 1;

  return (
    <div className="status-list">
      {items.map((it) => {
        const v = Number(it.value) || 0;
        const w =
          mode === 'share'
            ? Math.min(Math.max(v, 0), 1) * 100
            : (v / max) * 100;
        return (
          <div className="status-row" key={it.label} title={it.title}>
            <span className="status-label">{it.label}</span>
            <div className="status-track">
              <div
                className={`status-fill ${it.tone ?? tone}`}
                style={{ '--w': `${w.toFixed(2)}%` }}
              />
            </div>
            <span className="status-value">
              {it.text}
              {it.sub && (
                <>
                  <br />
                  <small className="is-muted">{it.sub}</small>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
