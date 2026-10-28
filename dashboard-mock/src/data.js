// Мок-данные для дашборда «Продажи и исполнение заказа».
// Значения правдоподобные, захардкожены: это визуальный мок, не расчёт.

export const months = [
  { m: '2017-01', orders: 734 },   { m: '2017-02', orders: 1564 },
  { m: '2017-03', orders: 1794 },  { m: '2017-04', orders: 1957 },
  { m: '2017-05', orders: 2939 },  { m: '2017-06', orders: 3297 },
  { m: '2017-07', orders: 3933 },  { m: '2017-08', orders: 4125 },
  { m: '2017-09', orders: 4442 },  { m: '2017-10', orders: 4500 },
  { m: '2017-11', orders: 4455 },  { m: '2017-12', orders: 5406 },
  { m: '2018-01', orders: 6967 },  { m: '2018-02', orders: 6926 },
  { m: '2018-03', orders: 7507 },  { m: '2018-04', orders: 8652 },
  { m: '2018-05', orders: 9082 },  { m: '2018-06', orders: 8520 },
  { m: '2018-07', orders: 9280 },  { m: '2018-08', orders: 8023 },
  { m: '2018-09', orders: 9083 },  { m: '2018-10', orders: 5397 }, // октябрь — частично
];

// Товарная выручка по месяцам (млн ₽). Средний чек «дышит» по месяцам,
// поэтому линии заказов и выручки не дублируют друг друга.
const checkFactors = [
  4.6, 4.1, 4.4, 4.2, 4.5, 4.3, 4.6, 4.4, 4.2, 4.5, 4.7, 4.4,
  4.1, 4.2, 4.0, 4.3, 4.1, 4.4, 4.2, 4.6, 4.3, 4.5,
];

export const revenueByMonth = months.map((x, i) => ({
  ...x,
  revenue: +((x.orders * checkFactors[i]) / 1000).toFixed(1),
}));

const monthShort = [' янв ', ' фев ', ' мар ', ' апр ', ' май ', ' июн ', ' июл ', ' авг ', ' сен ', ' окт ', ' ноя ', ' дек '];
export const monthLabel = (m) => {
  const [y, mm] = m.split('-').map(Number);
  return `${monthShort[mm - 1].trim()} ${y.toString().slice(2)}`;
};

export const kpis = [
  { id: 'orders',  label: 'Оформленные заказы', value: 99447,  fmt: 'int', suffix: '',      sub: 'янв 2017 – окт 2018' },
  { id: 'revenue', label: 'Товарная выручка',   value: 367.9,  fmt: 'dec', suffix: ' млн ₽', sub: 'доставленные, без доставки' },
  { id: 'avg',     label: 'Средний чек',        value: 4342,   fmt: 'int', suffix: ' ₽',     sub: 'товары + доставка, на заказ' },
  { id: 'ontime',  label: 'Доставка в срок',    value: 92.4,   fmt: 'dec', suffix: ' %',     sub: 'по 76 118 заказам с датами' },
  { id: 'time',    label: 'Время доставки',     value: 11.4,   fmt: 'dec', suffix: ' дн',    sub: 'медиана 9,7 дн' },
  { id: 'repeat',  label: 'Повторные покупатели', value: 3.2,  fmt: 'dec', suffix: ' %',     sub: 'когорта янв 2017, 6 мес' },
];

export const statuses = [
  { label: 'Доставлен',   value: 90.0, tone: 'accent' },
  { label: 'Отправлен',   value: 8.3,  tone: 'mid' },
  { label: 'Отменён',     value: 1.1,  tone: 'mid' },
  { label: 'Недоступен',  value: 0.4,  tone: 'faint' },
  { label: 'В обработке', value: 0.2,  tone: 'faint' },
];

export const delivery = [
  { label: 'В срок',        value: '92,4 %', note: '70 331 заказ' },
  { label: 'Опоздания',     value: '7,6 %',  note: '5 787 заказов' },
  { label: 'Позже 15 дней', value: '2,1 %',  note: '1 613 заказов' },
  { label: 'Среднее время', value: '11,4 дн', note: 'покупка → вручение' },
  { label: 'Медианное время', value: '9,7 дн', note: 'покупка → вручение' },
];

export const categories = [
  { name: 'Здоровье и красота',       revenue: 68.4, orders: 15412, avg: 4437 },
  { name: 'Электроника и компьютеры', revenue: 74.9, orders: 11982, avg: 6254 },
  { name: 'Мебель и декор',           revenue: 56.2, orders: 13476, avg: 4172 },
  { name: 'Спорт и досуг',            revenue: 39.7, orders: 9845,  avg: 4033 },
  { name: 'Постельное и ванная',      revenue: 30.1, orders: 8120,  avg: 3709 },
  { name: 'Часы и аксессуары',        revenue: 28.6, orders: 7340,  avg: 3896 },
  { name: 'Стройматериалы',           revenue: 24.8, orders: 5120,  avg: 4844 },
  { name: 'Авто',                     revenue: 21.5, orders: 4652,  avg: 4621 },
];

export const filters = {
  statuses: ['Все', 'Доставлен', 'Отправлен', 'Отменён'],
  months: ['Окт 2018', 'Сен 2018', 'Авг 2018', 'Всё время'],
  categories: ['Все категории', 'Здоровье и красота', 'Электроника', 'Мебель и декор'],
  sellers: ['Все продавцы', 'Топ-10', 'Остальные'],
  states: ['Все штаты', 'SP', 'RJ', 'MG', 'RS'],
};
