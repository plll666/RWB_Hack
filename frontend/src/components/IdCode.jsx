import { useState } from 'react';

/**
 * Копируемый идентификатор (order_id / product_id / seller_id)
 * — требование плана: значения из таблиц можно унести в SQL и проверить вручную.
 */
export default function IdCode({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // fallback для не-https-контекстов
      const tmp = document.createElement('textarea');
      tmp.value = value;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      tmp.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <span className="id-code" title={value}>
      <code>{value}</code>
      <button
        type="button"
        className={`id-copy${copied ? ' is-copied' : ''}`}
        onClick={copy}
        aria-label={`Скопировать ${value}`}
      >
        {copied ? '✓' : 'копир.'}
      </button>
    </span>
  );
}
