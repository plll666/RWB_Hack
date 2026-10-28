import { useState } from 'react';

const PRESETS = [
  { id: 'all', label: 'Весь период' },
  { id: '2018', label: '2018 год' },
  { id: '2017', label: '2017 год' },
  { id: 'last12', label: 'Последние 12 мес.' },
];

/** Пресет + точные границы (ISO) — вычисление на фронте, бэкенд получает только даты. */
export function applyPreset(presetId, bounds) {
  if (!bounds?.min_date || !bounds?.max_date) return null;
  const min = bounds.min_date;
  const max = bounds.max_date;
  switch (presetId) {
    case '2018':
      return { from: '2018-01-01', to: '2018-12-31' };
    case '2017':
      return { from: '2017-01-01', to: '2017-12-31' };
    case 'last12': {
      const d = new Date(max);
      d.setMonth(d.getMonth() - 11);
      d.setDate(1);
      return { from: d.toISOString().slice(0, 10), to: max };
    }
    default:
      return { from: min, to: max };
  }
}

/** Пресеты периода + поля дат + исторический штат покупателя (чекбоксы). */
export default function FilterBar({ bounds, states, filter, onChange }) {
  const activePreset =
    PRESETS.find(
      (p) =>
        p.id === 'all' &&
        filter.dateFrom === bounds?.min_date &&
        filter.dateTo === bounds?.max_date,
    )?.id ??
    PRESETS.find(
      (p) =>
        p.id !== 'all' &&
        JSON.stringify(applyPreset(p.id, bounds)) ===
          JSON.stringify({ from: filter.dateFrom, to: filter.dateTo }),
    )?.id ??
    '';

  const setRange = (from, to) => onChange({ ...filter, dateFrom: from, dateTo: to });

  const toggleState = (st) => {
    const has = filter.states.includes(st);
    onChange({
      ...filter,
      states: has ? filter.states.filter((s) => s !== st) : [...filter.states, st],
    });
  };

  return (
    <div className="filterbar" aria-label="Фильтры">
      <div className="filterbar-group">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${activePreset === p.id ? ' is-active' : ''}`}
            onClick={() => {
              const r = applyPreset(p.id, bounds);
              if (r) setRange(r.from, r.to);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="filterbar-selects">
        <label className="filterbar-group" title="Дата оформления заказа">
          <span className="filterbar-label">С</span>
          <input
            type="date"
            className="datefield"
            min={bounds?.min_date ?? '2016-01-01'}
            max={bounds?.max_date ?? '2018-12-31'}
            value={filter.dateFrom}
            onChange={(e) => setRange(e.target.value || bounds?.min_date, filter.dateTo)}
          />
          <span className="filterbar-label">по</span>
          <input
            type="date"
            className="datefield"
            min={bounds?.min_date ?? '2016-01-01'}
            max={bounds?.max_date ?? '2018-12-31'}
            value={filter.dateTo}
            onChange={(e) => setRange(filter.dateFrom, e.target.value || bounds?.max_date)}
          />
        </label>

        <StatePicker states={states} selected={filter.states} onToggle={toggleState}
          onClear={() => onChange({ ...filter, states: [] })} />
      </div>
    </div>
  );
}

function StatePicker({ states, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0 ? 'Штаты: все' : `Штаты: ${selected.length}`;

  return (
    <details className="dropdown" open={open} onToggle={(e) => setOpen(e.target.open)}>
      <summary className={`dropdown-summary${selected.length ? ' is-active' : ''}`}>
        {label} ▾
      </summary>
      {open && (
        <div className="dropdown-body">
          {states.map((st) => (
            <label className="dropdown-item" key={st}>
              <input
                type="checkbox"
                checked={selected.includes(st)}
                onChange={() => onToggle(st)}
              />
              <span>{st}</span>
            </label>
          ))}
          <div className="dropdown-actions">
            <button type="button" className="chip" onClick={onClear}>Все</button>
            <button type="button" className="chip" onClick={() => setOpen(false)}>Готово</button>
          </div>
        </div>
      )}
    </details>
  );
}
