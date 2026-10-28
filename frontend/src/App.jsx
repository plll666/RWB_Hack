import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import TopBar from './components/TopBar.jsx';
import FilterBar from './components/FilterBar.jsx';
import OverviewTab from './components/tabs/OverviewTab.jsx';
import DeliveryTab from './components/tabs/DeliveryTab.jsx';
import CategoriesTab from './components/tabs/CategoriesTab.jsx';
import QualityTab from './components/tabs/QualityTab.jsx';
import {
  ApiError,
  fetchCategories,
  fetchChampion,
  fetchDelivery,
  fetchMeta,
  fetchOverview,
  fetchQuality,
} from './api.js';

gsap.registerPlugin(useGSAP);

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'delivery', label: 'Доставка' },
  { id: 'categories', label: 'Категории и продавцы' },
  { id: 'quality', label: 'Качество данных' },
];

export default function App() {
  const root = useRef(null);
  const [tab, setTab] = useState('overview');
  const [meta, setMeta] = useState(null);
  const [minOrders, setMinOrders] = useState(500);

  // Глобальные фильтры: заполняются после /api/meta; до этого загрузка не идёт.
  const [filter, setFilter] = useState(null);
  // Локальные фильтры вкладки «Категории и продавцы».
  const [local, setLocal] = useState({ categoryIds: [], sellerId: '' });

  const [data, setData] = useState({});      // { overview, delivery, quality }
  const [catData, setCatData] = useState(null);
  const [champion, setChampion] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Метаданные: границы периода + штаты. Раз при старте.
  useEffect(() => {
    (async () => {
      try {
        const m = await fetchMeta();
        setMeta(m);
        setFilter({ dateFrom: m.bounds?.min_date, dateTo: m.bounds?.max_date, states: [] });
      } catch (err) {
        setError(err);
        setLoading(false);
      }
    })();
  }, []);

  // 2. Данные активной вкладки при смене фильтров/таба.
  useEffect(() => {
    if (!filter) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (tab === 'overview') {
          const d = await fetchOverview(filter);
          if (alive) setData((prev) => ({ ...prev, overview: d }));
        } else if (tab === 'delivery') {
          const d = await fetchDelivery(filter, minOrders);
          if (alive) setData((prev) => ({ ...prev, delivery: d }));
        } else if (tab === 'categories') {
          const [d, ch] = await Promise.all([
            fetchCategories(filter, local),
            champion === null ? fetchChampion().catch(() => null) : Promise.resolve(champion),
          ]);
          if (alive) {
            setCatData(d);
            if (ch) setChampion(ch);
          }
        } else if (tab === 'quality') {
          const d = await fetchQuality();
          if (alive) setData((prev) => ({ ...prev, quality: d }));
        }
      } catch (err) {
        if (alive) setError(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab, filter, minOrders, local]);

  // Входная анимация — как в моке; при reduced motion gsap.matchMedia отключает.
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
          gsap
            .timeline({ defaults: { ease: 'power3.out' } })
            .from('.topbar', { y: -8, autoAlpha: 0, duration: 0.4 })
            .from('.filterbar', { y: -6, autoAlpha: 0, duration: 0.4 }, 0.08)
            .from('.tabsbar', { y: -6, autoAlpha: 0, duration: 0.35 }, 0.12)
            .from('.dash > .strip .strip-cell', { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.05 }, 0.15)
            .from('.grid-main > .panel', { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, 0.3)
            .from('.delivery-section .section-h', { y: 8, autoAlpha: 0, duration: 0.4 }, 0.4)
            .fromTo('.chart-path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' }, 0.55)
            .from('.status-fill', { scaleX: 0, duration: 0.7, stagger: 0.06, transformOrigin: '0 50%' }, 0.6)
            .from('.cat-row, .cat-table tbody tr', { y: 8, autoAlpha: 0, duration: 0.35, stagger: 0.02 }, 0.5);
        },
      );
    },
    { scope: root },
  );

  const retry = useCallback(() => window.location.reload(), []);

  return (
    <div className="dash" ref={root}>
      <TopBar snapshot={meta?.bounds?.max_date?.split('-')?.reverse().join('.')} />

      {error && (
        <div className="error-banner" role="alert">
          <b>Ошибка загрузки данных.</b>{' '}
          {error instanceof ApiError
            ? error.message
            : String(error?.message ?? error)}
          <pre>
            Проверьте последовательность из README: сборка модели → mart.sql →
            uvicorn backend.main:app --port 8000 → npm run dev (frontend).
          </pre>
          <button type="button" className="chip" onClick={retry}>Повторить</button>
        </div>
      )}

      {filter && (
        <FilterBar bounds={meta?.bounds} states={meta?.states ?? []} filter={filter}
          onChange={setFilter} />
      )}

      <div className="tabsbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {loading && (
          <span className="loading-row">
            <span className="spin" /> загрузка…
          </span>
        )}
      </div>

      {!error && tab === 'overview' && <OverviewTab data={!loading ? data.overview : null} />}
      {!error && tab === 'delivery' && (
        <DeliveryTab data={!loading ? data.delivery : null}
          minOrders={minOrders} onMinOrders={setMinOrders} />
      )}
      {!error && tab === 'categories' && (
        <CategoriesTab data={!loading ? catData : null} filter={filter}
          local={local} onLocal={setLocal} champion={champion} />
      )}
      {!error && tab === 'quality' && <QualityTab data={!loading ? data.quality : null} />}
    </div>
  );
}
