import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { fmtInt, monthLabel } from '../lib/format.js';

const W = 760, H = 340, L = 58, R = 66, T = 22, B = 28;
const innerW = W - L - R, innerH = H - T - B;

const TIP_W = 132, TIP_H = 58, TIP_PAD = 10;

/** Красивый максимум оси: округление вверх до 1/2/5×10^k. */
const niceMax = (v) => {
  if (!v || v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const base = v / pow;
  const step = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
  return step * pow;
};

/**
 * SVG-диаграмма с двумя рядами: заказы (акцентная линия, левая ось)
 * и товарная выручка (пунктир, правая ось, млн R$).
 * Кроссхейр с тултипом — при reduced motion следует мгновенно, без easing.
 */
export default function LineChart({ data, note }) {
  // data: [{ month: '2017-08', orders, revenue }] — реальные значения из /api/overview
  const chartRef = useRef(null);
  const hoverRef = useRef(null);
  const dotRef = useRef(null);
  const dot2Ref = useRef(null);
  const tipRef = useRef(null);
  const monthRef = useRef(null);
  const t1Ref = useRef(null), v1Ref = useRef(null);
  const t2Ref = useRef(null), v2Ref = useRef(null);

  const series = data ?? [];
  const n = series.length;

  const maxOrders = niceMax(Math.max(...series.map((d) => d.orders), 1));
  const maxRev = niceMax(Math.max(...series.map((d) => d.revenue / 1e6), 0.001));

  const xAt = (i) => (n <= 1 ? L + innerW / 2 : L + (innerW * i) / (n - 1));
  const yOrders = (v) => T + innerH - (innerH * v) / maxOrders;
  const yRev = (v) => T + innerH - (innerH * (v / 1e6)) / maxRev;

  const ordersPath = series
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yOrders(d.orders)}`)
    .join(' ');
  const revPath = series
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yRev(d.revenue)}`)
    .join(' ');
  const areaPath =
    n > 1
      ? `${ordersPath} L${xAt(n - 1)},${T + innerH} L${xAt(0)},${T + innerH} Z`
      : '';

  const ordTicks = [0, 1, 2, 3, 4].map((k) => ({ v: (maxOrders / 4) * k }));
  const revTicks = [0, 1, 2, 3, 4].map((k) => {
    const v = (maxRev / 4) * k;
    return { v: v >= 10 ? Math.round(v) : Math.round(v * 10) / 10 };
  });

  const xStep = Math.max(1, Math.ceil((n - 1) / 5));
  const xTicks = series
    .map((d, i) => ({ i, month: d.month }))
    .filter(({ i }) => i === 0 || i === n - 1 || i % xStep === 0);

  // Кроссхейр с тултипом: прямая обратная связь за курсором.
  // Пересчитывается при смене среза (серия другая — оси/точки другие).
  useGSAP(
    () => {
      if (!series.length) return;
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
        const i = Math.max(0, Math.min(n - 1, Math.round(((sx - L) / innerW) * (n - 1))));
        const px = xAt(i);
        const d = series[i];

        moveX(px);
        dotRef.current.setAttribute('cy', yOrders(d.orders));
        dot2Ref.current.setAttribute('cy', yRev(d.revenue));

        // тултип не вылезает за правый край — разворачивается влево
        const flip = px > W - R - (TIP_W + TIP_PAD + 8);
        const tipX = flip ? -(TIP_W + TIP_PAD) : TIP_PAD;
        const tx = tipX + 10;
        const vx = tipX + TIP_W - 10;

        tipRef.current.setAttribute('x', tipX);
        monthRef.current.setAttribute('x', tx);
        t1Ref.current.setAttribute('x', tx);
        v1Ref.current.setAttribute('x', vx);
        t2Ref.current.setAttribute('x', tx);
        v2Ref.current.setAttribute('x', vx);

        monthRef.current.textContent = monthLabel(d.month);
        t1Ref.current.textContent = 'Заказы';
        v1Ref.current.textContent = fmtInt(d.orders);
        t2Ref.current.textContent = 'Выручка';
        v2Ref.current.textContent =
          `${(d.revenue / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн R$`;

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
    { dependencies: [series], scope: chartRef },
  );

  return (
    <div className="panel">
      <div className="panel-h">
        <h3 className="panel-title">Динамика по месяцам</h3>
        {note && <span className="panel-note">{note}</span>}
      </div>

      <svg
        ref={chartRef}
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Заказы и выручка по месяцам"
        style={{ width: '100%' }}
      >
        {/* сетка + оси */}
        {ordTicks.map(({ v }, k) => (
          <g key={`g${k}`}>
            <line className="chart-grid" x1={L} x2={W - R} y1={yOrders(v)} y2={yOrders(v)} />
            <text className="chart-axis" x={L - 7} y={yOrders(v) + 3} textAnchor="end">
              {fmtInt(v)}
            </text>
          </g>
        ))}
        {revTicks.map(({ v }, k) => (
          <text key={`r${k}`} className="chart-axis" x={W - R + 7} y={yRev(v * 1e6) + 3}>
            {v}
          </text>
        ))}
        {xTicks.map((t) => (
          <text key={t.month} className="chart-axis" x={xAt(t.i)} y={H - 8} textAnchor="middle">
            {monthLabel(t.month)}
          </text>
        ))}

        {/* выручка — стальной пунктир */}
        <path d={revPath} className="chart-path-dashed" />

        {/* заливка под заказами */}
        {n > 1 && <path d={areaPath} className="chart-area" />}

        {/* заказы — акцентная линия, отрисовка через dashoffset (pathLength=1) */}
        <path d={ordersPath} className="chart-path" pathLength="1" />

        {/* последняя точка — месяц снимка может быть неполным */}
        {n > 0 && (
          <>
            <circle className="chart-end-halo" cx={xAt(n - 1)} cy={yOrders(series[n - 1].orders)} r={8} />
            <circle className="chart-end-dot" cx={xAt(n - 1)} cy={yOrders(series[n - 1].orders)} r={3.5} />
          </>
        )}

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
        <span><span className="legend-key" />Заказы, шт (левая ось)</span>
        <span><span className="legend-key is-dashed" />Товарная выручка, млн R$ (правая ось)</span>
      </div>
    </div>
  );
}
