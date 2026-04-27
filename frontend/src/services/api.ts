import type { CandlestickBar, Technicals, AISuggestion, RiskResult, NewsItem, ScanResponse } from '../types'

// Dev: empty string → Vite proxy forwards /api/* to localhost:8000
// Prod: set VITE_API_URL=https://your-app.onrender.com in Vercel env vars
const ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const BASE   = `${ORIGIN}/api`

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export const api = {
  candles: (ticker: string, period = '5d', interval = '5m') =>
    get<{ bars: CandlestickBar[] }>(`/market/candles/${ticker}?period=${period}&interval=${interval}`),

  price: (ticker: string) =>
    get<{ price: number }>(`/market/price/${ticker}`),

  technicals: (ticker: string) =>
    get<{ technicals: Technicals }>(`/market/technicals/${ticker}`),

  autoSuggest: (ticker: string, highImpactEvent = false) =>
    get<AISuggestion>(`/ai/auto-suggest/${ticker}?high_impact_event=${highImpactEvent}`),

  news: (ticker = '', limit = 20) =>
    get<{ items: NewsItem[] }>(`/news/?ticker=${ticker}&limit=${limit}`),

  calculateRisk: (portfolio: number, entry: number, stopLoss: number, riskPct = 2) =>
    post<RiskResult>('/risk/calculate', {
      portfolio_value: portfolio,
      entry_price:     entry,
      stop_loss_price: stopLoss,
      risk_percent:    riskPct,
    }),

  scan: () => get<ScanResponse>('/scanner/scan'),

  clearScanCache: () => fetch(`${BASE}/scanner/cache`, { method: 'DELETE' }),
}

// Derive WebSocket base from API URL
// Dev:  ws://127.0.0.1:8000
// Prod: wss://your-app.onrender.com
export function wsBase(): string {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
  if (apiUrl) {
    return apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws').replace(/\/$/, '')
  }
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://127.0.0.1:8000`
}
