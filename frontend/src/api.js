// Клиент FastAPI-бэкенда. В дев-режиме запросы идут через прокси Vite (/api → :8000),
// поэтому база не захардкожена: приложение работает и за reverse-proxy.
//
// Ошибки не маскируются: при 503 текст из detail (инструкция по сборке модели)
// поднимается наверх и показывается баннером в интерфейсе.

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, params) {
  const url = new URL(path, window.location.origin)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item)
    } else {
      url.searchParams.append(key, value)
    }
  }

  let response
  try {
    response = await fetch(url)
  } catch (err) {
    throw new ApiError(
      'Бэкенд не отвечает. Запустите FastAPI из корня репозитория: ' +
        'uvicorn backend.main:app --port 8000 (см. README).',
      0,
    )
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* тело не JSON — оставляем статус */
    }
    throw new ApiError(detail, response.status)
  }
  return response.json()
}

export const fetchHealth = () => request('/api/health')
export const fetchMeta = () => request('/api/meta')

export const fetchOverview = (f) =>
  request('/api/overview', { date_from: f.dateFrom, date_to: f.dateTo, states: f.states })

export const fetchDelivery = (f, minOrders) =>
  request('/api/delivery', {
    date_from: f.dateFrom,
    date_to: f.dateTo,
    states: f.states,
    min_orders: minOrders,
  })

export const fetchCategories = (f, local) =>
  request('/api/categories', {
    date_from: f.dateFrom,
    date_to: f.dateTo,
    states: f.states,
    category_ids: local.categoryIds,
    seller_id: local.sellerId,
  })

export const fetchProduct = (productId, f, local) =>
  request(`/api/product/${encodeURIComponent(productId)}`, {
    date_from: f.dateFrom,
    date_to: f.dateTo,
    states: f.states,
    category_ids: local.categoryIds,
    seller_id: local.sellerId,
  })

export const fetchChampion = () => request('/api/product/champion')
export const fetchQuality = () => request('/api/quality')
