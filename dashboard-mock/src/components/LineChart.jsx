import { monthLabel, months, revenueByMonth } from '../data.js';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const W = 760, H = 340, L = 46, R = 60, T = 22, B = 28;
const innerW = W - L - R, innerH = H - T - B;
const N = months.length;

const ordersMax = 10000;
const revMax = 44; // млн ₽

const xAt = (i) => L + (innerW * i) / (N - 1);
const yOrders = (v) => T + innerH - (innerH * v) / ordersMax;
const yRev = (v) => T + innerH - (innerH * v) / revMax;

const line = (mappers) =>
  mappers.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

const ordersPath = line(months.map((x, i) => [xAt(i), yOrders(x.orders)]));
const revPath = line(revenueByMonth.map((x, i) => [xAt(i), yRev(x.revenue)]));

// Заливка под линией заказов
const areaPath = `${ordersPath} L${xAt(N - 1)},${T + innerH} L${xAt(0)},${T + innerH} Z`;

// Последняя точка (окт 2018) — маркер
const lastX = xAt(N - 1);
const lastY = yOrders(months[N - 1].orders);

const yTicksOrders = [0, 2500, 5000, 7500, 10000];
const yTicksRev = [0, 11, 22, 33, 44];
const xTicks = [
  { i: 0, label: monthLabel('2017-01') },
  { i: 6, label: monthLabel('2017-07') },
  { i: 12, label: monthLabel('2018-01') },
  { i: 18, label: monthLabel('2018-07') },
  { i: N - 1, label: monthLabel('2018-10') },
];

// Габариты тултипа
const TIP_W = 122, TIP_H = 58, TIP_PAD = 10;

export default function LineChart() {
  const chartRef = useRef(null);
  const hoverRef = useRef(null);
  const dotRef = useRef(null); // точка на линии заказов
  const dot2Ref = useRef(null); // точка на линии выручки
  const tipRef = useRef(null); // фон тултипа
  const monthRef = useRef(null);
  const t1Ref = useRef(null), v1Ref = useRef(null);
  const t2Ref = useRef(null), v2Ref = useRef(null);

  // Кроссхейр с тултипом: прямая обратная связь за курсором.
  // При reduced motion показ остаётся — убирается только плавное следование.
  useGSAP(
    () => {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const moveX = gsap.quickTo(hoverRef.current, 'x', {
        duration: reduce ? 0 : 0.18,
        ease: 'power2.out',
      });

      const onMove = (e) => {
        const svg = chartRef.current;
        const rect = svg.getBoundingClientRect();
        const sx = ((e.clientX - rect.left) / rect.width) * W;
        const i = Math.max(0, Math.min(N - 1, Math.round(((sx - L) / innerW) * (N - 1))));
        const px = xAt(i);

        moveX(px);
        dotRef.current.setAttribute('cy', yOrders(months[i].orders));
        dot2Ref.current.setAttribute('cy', yRev(revenueByMonth[i].revenue));

        // тултип не вылезает за правый край — разворачивается влево
        const flip = px > W - R - (TIP_W + TIP_PAD + 8);
        const tipX = flip ? -(TIP_W + TIP_PAD) : TIP_PAD;
        const tx = tipX + 10; // текст с внутренним отступом
        const vx = tipX + TIP_W - 10; // значения по правому краю

        tipRef.current.setAttribute('x', tipX);
        monthRef.current.setAttribute('x', tx);
        t1Ref.current.setAttribute('x', tx);
        v1Ref.current.setAttribute('x', vx);
        t2Ref.current.setAttribute('x', tx);
        v2Ref.current.setAttribute('x', vx);

        monthRef.current.textContent = monthLabel(months[i].m) + (i === N - 1 ? ' (част.)' : '');
        t1Ref.current.textContent = 'Заказы';
        v1Ref.current.textContent = months[i].orders.toLocaleString('ru-RU');
        t2Ref.current.textContent = 'Выручка';
        v2Ref.current.textContent = `${revenueByMonth[i].revenue.toLocaleString('ru-RU')} млн ₽`;

        // inline-стили, не атрибуты: inline перебивает атрибуты и не даёт тултипу «залипнуть»
        gsap.set(hoverRef.current, { autoAlpha: 1, overwrite: 'auto' });
      };
      const onLeave = () => gsap.to(hoverRef.current, { autoAlpha: 0, duration: 0.2 });

      const el = chartRef.current;
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      return () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    },
    { scope: chartRef }
  );

  return (
    <div className="panel">
      <div className="panel-h">
        <h3 className="panel-title">Динамика по месяцам</h3>
        <span className="panel-note">окт 2018 — частично</span>
      </div>

      <svg
        ref={chartRef}
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Заказы и выручка по месяцам"
      >
        {/* сетка + оси */}
        {yTicksOrders.map((v) => (
          <g key={`g${v}`}>
            <line className="chart-grid" x1={L} x2={W - R} y1={yOrders(v)} y2={yOrders(v)} />
            <text className="chart-axis" x={L - 7} y={yOrders(v) + 3} textAnchor="end">
              {v.toLocaleString('ru-RU')}
            </text>
          </g>
        ))}
        {yTicksRev.map((v) => (
          <text key={`r${v}`} className="chart-axis" x={W - R + 7} y={yRev(v) + 3}>
            {v}
          </text>
        ))}
        {xTicks.map((t) => (
          <text key={t.label} className="chart-axis" x={xAt(t.i)} y={H - 8} textAnchor="middle">
            {t.label}
          </text>
        ))}

        {/* выручка — стальной пунктир */}
        <path d={revPath} className="chart-path-dashed" />

        {/* заливка под заказами */}
        <path d={areaPath} className="chart-area" />

        {/* заказы — акцентная линия, отрисовка через dashoffset (pathLength=1) */}
        <path d={ordersPath} className="chart-path" pathLength="1" />

        {/* последняя точка: октябрь частично */}
        <circle className="chart-end-halo" cx={lastX} cy={lastY} r={8} />
        <circle className="chart-end-dot" cx={lastX} cy={lastY} r={3.5} />

        {/* кроссхейр + тултип */}
        <g ref={hoverRef} opacity="0" style={{ visibility: 'hidden' }}>
          <rect className="chart-hover-bg" x={-1} y={T} width="2" height={innerH} rx="0.5" />
          <line className="chart-hover-line" x1={0} x2={0} y1={T} y2={T + innerH} />
          <circle ref={dot2Ref} className="chart-hover-dot-2" cx={0} cy={0} r={3.5} />
          <circle ref={dotRef} className="chart-hover-dot" cx={0} cy={0} r={4} />
          <rect
            ref={tipRef}
            className="chart-tip-bg"
            x={TIP_PAD}
            y={T + 6}
            width={TIP_W}
            height={TIP_H}
            rx={6}
          />
          <text ref={monthRef} className="chart-tip-month" x={0} y={T + 24}></text>
          <text ref={t1Ref} className="chart-tip-name" x={0} y={T + 42}></text>
          <text ref={v1Ref} className="chart-tip-val" x={0} y={T + 42} textAnchor="end"></text>
          <text ref={t2Ref} className="chart-tip-name" x={0} y={T + 57}></text>
          <text ref={v2Ref} className="chart-tip-val" x={0} y={T + 57} textAnchor="end"></text>
        </g>
      </svg>

      <div className="legend">
        <span><span className="legend-key" />Заказы, шт</span>
        <span><span className="legend-key is-dashed" />Товарная выручка, млн ₽ (правая ось)</span>
      </div>
    </div>
  );
}
