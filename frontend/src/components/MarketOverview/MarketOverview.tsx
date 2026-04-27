import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Shield, Zap } from 'lucide-react'
import { api } from '../../services/api'
import type { MarketOverview as MarketOverviewData, Quote, Top10Quote, SectorQuote } from '../../types'

const REFRESH_INTERVAL = 15_000

function fmt(n: number, dec = 2) { return (n ?? 0).toFixed(dec) }
function fmtVol(n: number) {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function DirIcon({ dir }: { dir: string }) {
  if (dir === 'up')   return <TrendingUp  size={13} className="text-bull flex-shrink-0" />
  if (dir === 'down') return <TrendingDown size={13} className="text-bear flex-shrink-0" />
  return <Minus size={13} className="text-muted flex-shrink-0" />
}

function ChangePill({ change, pct }: { change: number; pct: number }) {
  const up = change >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
      up ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'
    }`}>
      {up ? '+' : ''}{fmt(change)} ({up ? '+' : ''}{fmt(pct)}%)
    </span>
  )
}

function DayRange({ low, high, price }: { low: number; high: number; price: number }) {
  const pct = high === low ? 50 : ((price - low) / (high - low)) * 100
  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <span className="text-muted text-xs font-mono">{fmt(low)}</span>
      <div className="relative flex-1 h-1.5 bg-muted/20 rounded-full">
        <div
          className="absolute top-0 w-2 h-1.5 rounded-full bg-accent -translate-x-1/2"
          style={{ left: `${Math.max(4, Math.min(96, pct))}%` }}
        />
      </div>
      <span className="text-muted text-xs font-mono">{fmt(high)}</span>
    </div>
  )
}

function IndexCard({ q, label }: { q: Quote; label?: string }) {
  const up = q.direction === 'up'
  const down = q.direction === 'down'
  return (
    <div className={`flex-1 min-w-[130px] bg-surface rounded-xl border px-4 py-3 flex flex-col gap-1 ${
      up ? 'border-bull/30' : down ? 'border-bear/30' : 'border-muted/20'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text">{label ?? q.ticker}</span>
        <DirIcon dir={q.direction} />
      </div>
      <div className={`text-xl font-bold font-mono ${up ? 'text-bull' : down ? 'text-bear' : 'text-text'}`}>
        ${fmt(q.price)}
      </div>
      <ChangePill change={q.change} pct={q.change_pct} />
    </div>
  )
}

function VixGauge({ vix }: { vix: MarketOverviewData['vix'] }) {
  const val  = vix.price ?? 0
  const pct  = Math.min(100, (val / 50) * 100)
  const color = vix.color === 'bull' ? '#22c55e' : vix.color === 'warn' ? '#f59e0b' : '#ef4444'
  return (
    <div className="bg-surface border border-muted/20 rounded-xl px-4 py-3 flex flex-col gap-2 min-w-[160px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text">VIX Fear Gauge</span>
        <AlertTriangle size={13} className={vix.color === 'bull' ? 'text-bull' : vix.color === 'warn' ? 'text-warn' : 'text-bear'} />
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{fmt(val, 1)}</div>
      <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)' }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>Calm</span>
        <span className="font-semibold" style={{ color }}>{vix.zone}</span>
        <span>Panic</span>
      </div>
    </div>
  )
}

function MarketBiasCard({ bias, breadth }: { bias: string; breadth: MarketOverviewData['breadth'] }) {
  const Icon  = bias === 'BULLISH' ? TrendingUp : bias === 'BEARISH' ? TrendingDown : Minus
  const color = bias === 'BULLISH' ? 'text-bull' : bias === 'BEARISH' ? 'text-bear' : 'text-warn'
  const upPct = breadth.total ? Math.round((breadth.up / breadth.total) * 100) : 0
  return (
    <div className="bg-surface border border-muted/20 rounded-xl px-4 py-3 flex flex-col gap-2 min-w-[160px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text">Market Bias</span>
        <Icon size={13} className={color} />
      </div>
      <div className={`text-lg font-bold ${color}`}>{bias}</div>
      <div className="text-xs text-muted">Top-10 breadth</div>
      <div className="h-2 bg-bear/20 rounded-full overflow-hidden">
        <div className="h-full bg-bull rounded-full transition-all duration-500" style={{ width: `${upPct}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-bull">{breadth.up} up</span>
        <span className="text-bear">{breadth.down} down</span>
      </div>
    </div>
  )
}

function SectorBar({ sectors }: { sectors: SectorQuote[] }) {
  const sorted = [...sectors].sort((a, b) => b.change_pct - a.change_pct)
  const max    = Math.max(...sorted.map(s => Math.abs(s.change_pct)), 0.01)
  return (
    <div className="bg-surface border border-muted/20 rounded-xl px-4 py-3 flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2">
        <Zap size={13} className="text-accent" />
        <span className="text-xs font-bold text-text">Sector Performance</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {sorted.map(s => {
          const up   = s.change_pct >= 0
          const barW = Math.round((Math.abs(s.change_pct) / max) * 100)
          return (
            <div key={s.etf} className="flex items-center gap-2">
              <span className="text-xs text-muted w-20 flex-shrink-0">{s.name}</span>
              <div className="flex-1 h-1.5 bg-muted/15 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${up ? 'bg-bull' : 'bg-bear'}`}
                  style={{ width: `${barW}%` }}
                />
              </div>
              <span className={`text-xs font-mono font-semibold w-14 text-right ${up ? 'text-bull' : 'text-bear'}`}>
                {up ? '+' : ''}{fmt(s.change_pct)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Top10Table({ stocks, onSelect }: { stocks: Top10Quote[]; onSelect: (t: string) => void }) {
  return (
    <div className="bg-surface border border-muted/20 rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-muted/20">
        <Shield size={13} className="text-accent" />
        <span className="text-xs font-bold text-text">SPY Top 10 Holdings — Live</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-muted/10 text-muted">
              <th className="text-left px-4 py-2 font-semibold">Ticker</th>
              <th className="text-left px-4 py-2 font-semibold hidden sm:table-cell">Company</th>
              <th className="text-right px-4 py-2 font-semibold">Price</th>
              <th className="text-right px-4 py-2 font-semibold">Change</th>
              <th className="text-center px-4 py-2 font-semibold hidden md:table-cell">Day Range</th>
              <th className="text-right px-4 py-2 font-semibold hidden lg:table-cell">Volume</th>
              <th className="text-right px-4 py-2 font-semibold hidden lg:table-cell">SPY Wt%</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s, i) => {
              const up   = s.direction === 'up'
              const down = s.direction === 'down'
              return (
                <tr
                  key={s.ticker}
                  onClick={() => onSelect(s.ticker)}
                  className={`border-b border-muted/10 cursor-pointer transition-colors hover:bg-accent/5 ${
                    i % 2 === 0 ? 'bg-base/30' : ''
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <DirIcon dir={s.direction} />
                      <span className={`font-bold ${up ? 'text-bull' : down ? 'text-bear' : 'text-text'}`}>
                        {s.ticker}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted hidden sm:table-cell">{s.company}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-text">
                    ${fmt(s.price)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ChangePill change={s.change} pct={s.change_pct} />
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <DayRange low={s.day_low} high={s.day_high} price={s.price} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted hidden lg:table-cell">
                    {fmtVol(s.volume)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted hidden lg:table-cell">
                    {s.spy_weight}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SpyTip({ spy, vix, bias }: { spy: Quote; vix: MarketOverviewData['vix']; bias: string }) {
  const tips: string[] = []
  const spyUp = spy.change_pct > 0
  if (vix.price > 25)              tips.push('High VIX — expect large intraday swings. Widen stops or reduce size.')
  if (vix.price < 15)              tips.push('VIX is low — options are cheap. Directional plays have good R/R.')
  if (Math.abs(spy.change_pct) > 1) tips.push(`SPY moving ${spyUp ? 'strongly up' : 'strongly down'} ${Math.abs(spy.change_pct).toFixed(1)}% — trend-follow, don't fade.`)
  if (bias === 'BULLISH' && spyUp)  tips.push('Market uptrend. Favour long setups; avoid shorting strong stocks.')
  if (bias === 'BEARISH' && !spyUp) tips.push('Market downtrend. Stay light on longs; focus on short weak sectors.')
  if (bias === 'NEUTRAL')           tips.push('Market is choppy. Focus on individual stock catalysts, not broad direction.')
  if (spy.price < spy.day_low * 1.002)  tips.push('SPY near day low — watch for a flush or reversal candle.')
  if (spy.price > spy.day_high * 0.998) tips.push('SPY near day high — breakout possible or fade risk. Wait for confirmation.')
  if (tips.length === 0) return null
  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={13} className="text-accent" />
        <span className="text-xs font-bold text-accent">Day Trading Insights</span>
      </div>
      <ul className="space-y-1">
        {tips.map((t, i) => (
          <li key={i} className="text-xs text-text flex gap-2">
            <span className="text-accent flex-shrink-0">›</span><span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props { onSelectTicker: (t: string) => void }

export function MarketOverview({ onSelectTicker }: Props) {
  const [data, setData]             = useState<MarketOverviewData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [countdown, setCountdown]   = useState(REFRESH_INTERVAL / 1000)
  const activeRef = useRef(false)

  async function fetchOnce(): Promise<boolean> {
    try {
      const d = await api.marketOverview()
      setData(d)
      setLastUpdate(new Date())
      setCountdown(REFRESH_INTERVAL / 1000)
      return true
    } catch {
      return false
    }
  }

  async function load() {
    if (activeRef.current) return
    activeRef.current = true
    setLoading(true)
    await fetchOnce()
    setLoading(false)
    activeRef.current = false
  }

  async function refresh() {
    if (activeRef.current) return
    activeRef.current = true
    await fetchOnce()
    activeRef.current = false
  }

  useEffect(() => {
    load()
    const iv = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [lastUpdate])

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <RefreshCw size={22} className="text-accent animate-spin" />
        <p className="text-muted text-sm">Loading market data…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <AlertTriangle size={22} className="text-bear" />
        <p className="text-text text-sm font-semibold">Could not reach the backend</p>
        <p className="text-muted text-xs">Start the backend, then click retry:</p>
        <code className="text-xs text-accent bg-surface px-3 py-1.5 rounded border border-muted/20">
          cd backend &amp;&amp; uvicorn main:app --reload
        </code>
        <button
          onClick={load}
          className="mt-1 text-xs text-accent border border-accent/30 px-4 py-1.5 rounded hover:bg-accent/10 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  const spy = data.indices.find(i => i.ticker === 'SPY') ?? data.indices[0]
  const qqq = data.indices.find(i => i.ticker === 'QQQ') ?? data.indices[1]
  const iwm = data.indices.find(i => i.ticker === 'IWM') ?? data.indices[2]
  const dia = data.indices.find(i => i.ticker === 'DIA') ?? data.indices[3]

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-base">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-muted/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          <span className="text-sm font-bold text-text">Market Pulse</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
            data.market_bias === 'BULLISH' ? 'bg-bull/10 text-bull' :
            data.market_bias === 'BEARISH' ? 'bg-bear/10 text-bear' :
            'bg-warn/10 text-warn'
          }`}>{data.market_bias}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            Refreshes in <span className="text-accent font-mono">{countdown}s</span>
          </span>
          <button onClick={refresh} className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
          {lastUpdate && (
            <span className="text-xs text-muted hidden sm:block">{lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Index tiles */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          <IndexCard q={spy} label="SPY — S&P 500" />
          <IndexCard q={qqq} label="QQQ — Nasdaq" />
          <IndexCard q={iwm} label="IWM — Russell" />
          <IndexCard q={dia} label="DIA — Dow Jones" />
        </div>

        {/* Gauges */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          <VixGauge vix={data.vix} />
          <MarketBiasCard bias={data.market_bias} breadth={data.breadth} />
          <div className="flex-1 min-w-[280px]">
            <SectorBar sectors={data.sectors} />
          </div>
        </div>

        {/* Day trading tips */}
        <SpyTip spy={spy} vix={data.vix} bias={data.market_bias} />

        {/* Top 10 table */}
        <Top10Table stocks={data.top10} onSelect={onSelectTicker} />
      </div>
    </div>
  )
}
