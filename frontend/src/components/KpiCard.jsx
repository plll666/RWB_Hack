import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/**
 * Ячейка полосы метрик. Число оживляется count-up'ом;
 * при prefers-reduced-motion значение ставится сразу.
 * Моно-шрифт держит ширину цифр — табло не дёргается.
 */
export default function KpiCard({ kpi }) {
  // kpi: { id, label, value, format(v) -> string, sub }
  const cellRef = useRef(null);
  const valueRef = useRef(null);

  useGSAP(
    () => {
      const el = valueRef.current;
      if (!el) return;

      const output = typeof kpi.format === 'function' ? kpi.format : (v) => String(v);

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = output(kpi.value);
        return;
      }

      const o = { v: 0 };
      el.textContent = output(0);
      gsap.to(o, {
        v: kpi.value ?? 0,
        duration: 0.8,
        delay: 0.3,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = output(o.v);
        },
      });
    },
    { dependencies: [kpi.value], scope: cellRef },
  );

  return (
    <div className="strip-cell" ref={cellRef}>
      <p className="metric-label">{kpi.label}</p>
      <p className="metric-value">
        <span ref={valueRef}>{kpi.format ? kpi.format(kpi.value) : String(kpi.value)}</span>
        {kpi.suffix && <span className="metric-suffix">{kpi.suffix}</span>}
      </p>
      <p className="metric-sub">{kpi.sub}</p>
    </div>
  );
}
