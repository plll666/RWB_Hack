import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import KpiCard from './components/KpiCard.jsx';
import FilterBar from './components/FilterBar.jsx';
import LineChart from './components/LineChart.jsx';
import { StatusBars, DeliveryBlock, CategoryTable } from './components/Blocks.jsx';
import { kpis } from './data.js';
import './index.css';

gsap.registerPlugin(useGSAP);

export default function App() {
  const root = useRef(null);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('dash-theme') === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dash-theme', theme);
  }, [theme]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          ok: '(prefers-reduced-motion: no-preference)',
          reduce: '(prefers-reduced-motion: reduce)',
        },
        (ctx) => {
          if (ctx.conditions.reduce) return;

          const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

          tl.from('.topbar', { y: -8, autoAlpha: 0, duration: 0.4 })
            .from('.filterbar', { y: -6, autoAlpha: 0, duration: 0.4 }, 0.08)
            .from('.dash > .strip .strip-cell', { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.05 }, 0.15)
            .from('.grid-main > .panel', { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, 0.3)
            .from('.delivery-section .section-h', { y: 8, autoAlpha: 0, duration: 0.4 }, 0.4)
            .from('.delivery-section .strip-cell', { y: 10, autoAlpha: 0, duration: 0.4, stagger: 0.05 }, 0.45)
            .fromTo(
              '.chart-path',
              { strokeDashoffset: 1 },
              { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' },
              0.55
            )
            .from('.chart-area', { autoAlpha: 0, duration: 0.6 }, 0.95)
            .from('.chart-path-dashed', { autoAlpha: 0, duration: 0.5 }, 0.8)
            .from('.chart-end-halo', { scale: 0, duration: 0.4, ease: 'back.out(2)', transformOrigin: '50% 50%' }, 1.35)
            .from('.chart-end-dot', { scale: 0, duration: 0.3, transformOrigin: '50% 50%' }, 1.4)
            .from(
              '.status-fill',
              { scaleX: 0, duration: 0.7, stagger: 0.06, transformOrigin: '0 50%' },
              0.6
            )
            .from('.cat-row', { y: 8, autoAlpha: 0, duration: 0.35, stagger: 0.04 }, 0.5);
        }
      );
    },
    { scope: root }
  );

  return (
    <div className="dash" ref={root}>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Продажи и исполнение заказа</h1>
          <p className="topbar-sub">
            Руководителю операций и категорийным менеджерам · источник показателей — core
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
          <span className="topbar-tag">МОК · ДАННЫЕ ДО ОКТ 2018</span>
        </div>
      </header>

      <FilterBar />

      <div className="strip">
        {kpis.map((k) => (
          <KpiCard kpi={k} key={k.id} />
        ))}
      </div>

      <div className="grid-main">
        <LineChart />
        <StatusBars />
      </div>

      <DeliveryBlock />
      <CategoryTable />
    </div>
  );
}
