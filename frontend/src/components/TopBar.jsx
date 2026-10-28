import { useEffect, useState } from 'react';

/** Шапка: заголовок, назначение, переключатель темы, тег снимка данных. */
export default function TopBar({ snapshot }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('dash-theme') === 'light' ? 'light' : 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dash-theme', theme);
  }, [theme]);

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">Продажи и исполнение заказа</h1>
        <p className="topbar-sub">
          Руководителю операций и категорийным менеджерам · источник показателей —
          витрины mart, справочники core
        </p>
      </div>
      <div className="topbar-right">
        <button
          type="button"
          className="chip"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Переключить тему"
        >
          {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        </button>
        <span className="topbar-tag">
          Исторические данные до{snapshot ? ` ${snapshot}` : ' октября 2018'}
        </span>
      </div>
    </header>
  );
}
