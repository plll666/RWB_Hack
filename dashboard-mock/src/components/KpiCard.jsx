import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const nfInt = new Intl.NumberFormat('ru-RU');
const nfDec = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const format = (v, kind) =>
  kind === 'dec' ? nfDec.format(v) : nfInt.format(Math.round(v));

/**
 * Ячейка полосы метрик. Число оживляется count-up'ом;
 * при prefers-reduced-motion значение ставится сразу.
 * Моно-шрифт держит ширину цифр — табло не дёргается.
 */
export default function KpiCard({ kpi }) {
  const cellRef = useRef(null);
  const valueRef = useRef(null);

  useGSAP(() => {
    const el = valueRef.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = format(kpi.value, kpi.fmt);
      return;
    }

    const o = { v: 0 };
    gsap.set(el, { textContent: format(0, kpi.fmt) });
    gsap.to(o, {
      v: kpi.value,
      duration: 0.8,
      delay: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = format(o.v, kpi.fmt);
      },
    });
  }, { scope: cellRef });

  return (
    <div className="strip-cell" ref={cellRef}>
      <p className="metric-label">{kpi.label}</p>
      <p className="metric-value">
        <span ref={valueRef}>{format(kpi.value, kpi.fmt)}</span>
        {kpi.suffix && <span className="metric-suffix">{kpi.suffix}</span>}
      </p>
      <p className="metric-sub">{kpi.sub}</p>
    </div>
  );
}
