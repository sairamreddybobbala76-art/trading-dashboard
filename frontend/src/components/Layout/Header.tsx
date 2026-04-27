import { useState } from 'react'
import { Activity, Wifi, WifiOff, Search, Radio, BarChart2 } from 'lucide-react'

export type ViewMode = 'chart' | 'scanner'

interface Props {
  ticker: string
  onTickerChange: (t: string) => void
  price: number | null
  connected: boolean
  period: string
  onPeriodChange: (p: string) => void
  interval: string
  onIntervalChange: (i: string) => void
  view: ViewMode
  onViewChange: (v: ViewMode) => void
}

const PERIODS = ['1d', '5d', '1mo', '3mo']
const INTERVALS: Record<string, string[]> = {
  '1d': ['1m', '5m', '15m'],
  '5d': ['5m', '15m', '1h'],
  '1mo': ['1h', '1d'],
  '3mo': ['1d'],
}

export function Header({
  ticker, onTickerChange, price, connected,
  period, onPeriodChange, interval, onIntervalChange,
  view, onViewChange,
}: Props) {
  const [input, setInput] = useState(ticker)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (input.trim()) {
      onTickerChange(input.trim().toUpperCase())
      onViewChange('chart')   // switch to chart when searching a ticker
    }
  }

  return (
    <header className="h-14 bg-surface border-b border-muted/20 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-1">
        <Activity size={20} className="text-accent" />
        <span className="text-text font-bold text-sm tracking-wide hidden sm:block">TradeDash</span>
      </div>

      {/* View toggle */}
      <div className="flex items-center bg-base rounded-lg p-0.5 border border-muted/20 flex-shrink-0">
        <button
          onClick={() => onViewChange('chart')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
            view === 'chart'
              ? 'bg-accent/20 text-accent'
              : 'text-muted hover:text-text'
          }`}
        >
          <BarChart2 size={12} /> Chart
        </button>
        <button
          onClick={() => onViewChange('scanner')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
            view === 'scanner'
              ? 'bg-accent/20 text-accent'
              : 'text-muted hover:text-text'
          }`}
        >
          <Radio size={12} /> Scanner
        </button>
      </div>

      {/* Ticker Search — hidden in scanner view */}
      {view === 'chart' && (
        <>
          <form onSubmit={submit} className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                className="bg-panel border border-muted/30 rounded-lg pl-7 pr-3 py-1.5 text-xs text-text w-24 focus:outline-none focus:border-accent"
                placeholder="Ticker"
              />
            </div>
            <button type="submit" className="bg-accent/10 border border-accent/30 text-accent text-xs px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
              Go
            </button>
          </form>

          {/* Period toggles */}
          <div className="flex items-center gap-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { onPeriodChange(p); onIntervalChange(INTERVALS[p][0]) }}
                className={`text-xs px-2 py-1 rounded transition-colors ${period === p ? 'bg-accent/20 text-accent' : 'text-muted hover:text-text'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            {(INTERVALS[period] || []).map((i) => (
              <button
                key={i}
                onClick={() => onIntervalChange(i)}
                className={`text-xs px-2 py-1 rounded transition-colors ${interval === i ? 'bg-muted/30 text-text' : 'text-muted hover:text-text'}`}
              >
                {i}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Price + WS status */}
      <div className="ml-auto flex items-center gap-3">
        {view === 'chart' && price !== null && (
          <div className="text-right">
            <div className="text-text font-bold text-sm">${price.toFixed(2)}</div>
            <div className="text-muted text-xs">{ticker}</div>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs">
          {connected
            ? <><Wifi size={13} className="text-bull" /><span className="text-bull hidden sm:block">Live</span></>
            : <><WifiOff size={13} className="text-muted" /><span className="text-muted hidden sm:block">Offline</span></>
          }
        </div>
      </div>
    </header>
  )
}
