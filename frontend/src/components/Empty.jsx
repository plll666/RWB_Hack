/** Пустое состояние — явный текст «Нет данных», без заглушек и нулей. */
export default function Empty({ children }) {
  return (
    <div className="empty" role="status">
      {children || 'Нет данных.'}
    </div>
  );
}
