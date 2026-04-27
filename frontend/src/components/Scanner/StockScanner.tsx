import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import type { ScanResponse, ScanResult } from '../../types'
import { StockCard } from './StockCard'
import { Zap, Calendar, RefreshCw, Clock, AlertCircle, Radio } from 'lucide-react'

interface Props {
  onSelectTicker: (ticker: string) => void
}

const LOADING_MSGS = [
  'Fetching live price data…',
  'Computing RSI · MACD · VWAP · Bollinger…',
  'Scoring momentum across 30 stocks…',
  'Analyzing news sentiment…',
  'Reading StockTwits social pulse…',
  'Scanning options for whale flow…',
  'Calculating put/call ratios…',
  'Running AI composite scoring…',
  'Ranking day trade opportunities…',
  'Ranking weekly swing setups…',
  'Almost done — finalizing picks…',
]

function ScoreLegend() {
  return (
    <div className="flex items-center gap-4 text-[10px] text-muted">
      {[
        { color: 'bg-[#38bdf8]', label: 'Technical' },
        { color: 'bg-bull',      label: 'Momentum' },
        { color: 'bg-[#a78bfa]', label: 'Sentiment' },
        { color: 'bg-[#fb923c]', label: 'Whale Flow' },
        { color: 'bg-accent',    label: 'Risk/Reward' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

function SummaryStats({ data }: { data: ScanResponse }) {
  const buys   = data.top_overall.filter(s => s.decision === 'BUY').length
  const shorts = data.top_overall.filter(s => s.decision === 'SHORT').length
  const avgComposite = data.top_overall.reduce((a, b) => a + b.composite, 0) / (data.top_overall.length || 1)
  const topTicker = data.top_overall[0]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Stocks Scanned', value: data.scanned, color: 'text-text' },
        { label: 'Buy Signals',    value: buys,          color: 'text-bull' },
        { label: 'Short Signals',  value: shorts,        color: 'text-bear' },
        { label: 'Avg AI Score',   value: avgComposite.toFixed(1), color: avgComposite >= 65 ? 'text-bull' : 'text-warn' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-panel rounded-xl border border-muted/20 p-3 text-center">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-muted text-xs mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}

export function StockScanner({ onSelectTicker }: Props) {
  const [data, setData] = useState<ScanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msgIdx, setMsgIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [tab, setTab] = useState<'day' | 'weekly' | 'all'>('day')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  function startLoading() {
    setMsgIdx(0)
    setElapsed(0)
    intervalRef.current = setInterval(() => setMsgIdx(i => Math.min(i + 1, LOADING_MSGS.length - 1)), 2200)
    timerRef.current    = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  function stopLoading() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timerRef.current)    clearInterval(timerRef.current)
  }

  async function runScan(force = false) {
    if (loading) return
    if (force) await api.clearScanCache()
    setLoading(true)
    setError('')
    startLoading()
    try {
      const result = await api.scan()
      setData(result)
    } catch {
      setError('Scan failed — is the backend running? Check http://localhost:8000')
    } finally {
      setLoading(false)
      stopLoading()
    }
  }

  // Auto-run on first mount
  useEffect(() => {
    runScan()
    return stopLoading
  }, [])

  function handleSelect(ticker: string) {
    onSelectTicker(ticker)
  }

  const scanTime = data
    ? new Date(data.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const displayStocks: ScanResult[] =
    tab === 'day'    ? (data?.day_trades    ?? []) :
    tab === 'weekly' ? (data?.weekly_trades ?? []) :
                       (data?.top_overall   ?? [])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-muted/20 bg-surface px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-accent animate-pulse" />
          <span className="text-text font-bold text-sm tracking-wide">AI Stock Scanner</span>
          <span className="text-muted text-xs">· 30 high-liquidity tickers</span>
        </div>

        {scanTime && (
          <div className="flex items-center gap-1.5 text-xs text-muted ml-2">
            <Clock size={11} />
            <span>Last scan: {scanTime}</span>
            {data?.cached && <span className="text-accent text-[10px] border border-accent/30 rounded px-1">cached</span>}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ScoreLegend />
          <button
            onClick={() => runScan(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? `Scanning… ${elapsed}s` : 'Fresh Scan'}
          </button>
        </div>
      </div>

      {/* ── Loading state ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex-shrink-0 px-5 py-4 bg-accent/5 border-b border-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent animate-ping flex-shrink-0" />
            <p className="text-accent text-xs font-medium">{LOADING_MSGS[msgIdx]}</p>
          </div>
          <div className="mt-2 h-0.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-2000"
              style={{ width: `${Math.min((msgIdx / (LOADING_MSGS.length - 1)) * 100, 95)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex-shrink-0 mx-5 mt-4 flex items-center gap-2 bg-bear/10 border border-bear/30 rounded-lg px-4 py-3 text-bear text-xs">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <SummaryStats data={data} />

          {/* Section tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-muted/20">
            {([
              { id: 'day',    label: '⚡ Day Trade Picks',  count: data.day_trades.length },
              { id: 'weekly', label: '📅 Weekly Swings',    count: data.weekly_trades.length },
              { id: 'all',    label: '🏆 Top 10 Overall',   count: data.top_overall.length },
            ] as const).map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                  tab === id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                {label} <span className="ml-1 opacity-60">({count})</span>
              </button>
            ))}
          </div>

          {/* Section description */}
          <p className="text-muted text-xs mb-4">
            {tab === 'day'    && '⚡ High-composite stocks with strong intraday momentum and elevated volume — best for same-day entries.'}
            {tab === 'weekly' && '📅 Technically sound setups with positive trend alignment — swing trade over 3–7 days for larger targets.'}
            {tab === 'all'    && '🏆 Top 10 by composite AI score across all dimensions regardless of trade type.'}
            {' '}Click any card to open its chart.
          </p>

          {/* Cards grid */}
          {displayStocks.length === 0 ? (
            <div className="text-center text-muted text-sm py-12">No qualifying stocks found. Try a fresh scan.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayStocks.map((stock, i) => (
                <StockCard
                  key={stock.ticker}
                  stock={stock}
                  rank={i + 1}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-8 text-center text-muted/50 text-[10px] leading-relaxed max-w-2xl mx-auto">
            AI Scanner scores are based on technical indicators, news sentiment, and social data.
            This is not financial advice. All trading involves risk. Past signals do not guarantee future results.
            Always use proper position sizing and stop-losses.
          </p>
        </div>
      )}

      {/* Empty state before first scan */}
      {!data && !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <Radio size={40} className="text-accent/30" />
          <p className="text-muted text-sm">Click <span className="text-accent font-semibold">Fresh Scan</span> to analyze 30 stocks.</p>
        </div>
      )}
    </div>
  )
}
