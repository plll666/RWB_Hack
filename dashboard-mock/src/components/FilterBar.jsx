import { useState } from 'react';
import { filters } from '../data.js';

export default function FilterBar() {
  const [active, setActive] = useState(0); // визуальное состояние; пересчёта нет — это мок

  return (
    <div className="filterbar" aria-label="Фильтры (мок)">
      {filters.statuses.map((s, i) => (
        <button
          key={s}
          type="button"
          className={`chip${i === active ? ' is-active' : ''}`}
          onClick={() => setActive(i)}
        >
          {s}
        </button>
      ))}

      <div className="filterbar-selects">
        {['months', 'categories', 'sellers', 'states'].map((key) => (
          <select key={key} className="select" defaultValue={0} aria-label={key}>
            {filters[key].map((o, i) => (
              <option key={o} value={i}>{o}</option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
