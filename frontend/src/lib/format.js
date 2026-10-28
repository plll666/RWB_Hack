// Форматирование: русская локаль, моно-шрифт табло не дёргается.

const nfInt = new Intl.NumberFormat('ru-RU')
const nfDec1 = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const nfDec2 = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Целое: «99 441». null/NaN → «—». */
export const fmtInt = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : nfInt.format(Math.round(Number(v)))

/** Один десятичный знак: «93,2». */
export const fmtDec = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : nfDec1.format(Number(v))

/** Деньги: «13 221 498,11». */
export const fmtMoney = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : nfDec2.format(Number(v))

/** Деньги в млн R$: «13,2 млн R$». */
export const fmtMillion = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : `${nfDec1.format(Number(v) / 1e6)} млн R$`

/** Проценты: доля 0–1 → «93,2 %». */
export const fmtPct = (share, digits = 1) => {
  if (share === null || share === undefined || Number.isNaN(Number(share))) return '—'
  const p = Number(share) * 100
  const nf = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${nf.format(p)} %`
}

/** Дни доставки: «12,6». */
export const fmtDays = (v) =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v))
    ? '—'
    : `${nfDec1.format(Number(v))} дн.`

/** «2017-08» → «авг 2017». */
const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const monthLabel = (isoMonth) => {
  if (!isoMonth) return ''
  const [y, m] = String(isoMonth).split('-')
  return `${monthNames[Number(m) - 1] ?? m} ${y}`
}

/** Пол знаменателя доставки: «знаменатель: 96 470 доставленных заказов». */
export const denominatorNote = (n) =>
  n === null || n === undefined
    ? ''
    : `знаменатель: ${nfInt.format(n)} доставленных заказов с полным набором дат`

/** Деньги в интерфейсе категорий: значения приходят Decimal → «1 233 131,72». */
export const fmtPrice = (v) =>
  v === null || v === undefined || v === '' ? '—' : `R$ ${nfDec2.format(Number(v))}`
