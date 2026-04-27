import { useEffect, useState, useCallback } from 'react'
import { CandlestickChart } from '../Chart/CandlestickChart'
import { WhatIfSimulator } from '../Chart/WhatIfSimulator'
import { AIAssistant } from '../Sidebar/AIAssistant'
import { NewsFeed } from '../News/NewsFeed'
import { RiskCalculator } from '../RiskManager/RiskCalculator'
import { StockScanner } from '../Scanner/StockScanner'
import { MarketOverview } from '../MarketOverview/MarketOverview'
import { Header, type ViewMode } from './Header'
import { usePriceFeed } from '../../hooks/useWebSocket'
import { api } from '../../services/api'
import type { CandlestickBar, Technicals } from '../../types'
import { BarChart2, ShieldCheck } from 'lucide-react'

type RightPanel = 'whatif' | 'risk'

function TechnicalsBar({ data }: { data: Technicals | null }) {
  if (!data) return null
  const items = [
    { label: 'RSI',    value: data.rsi.toFixed(1),           color: data.rsi > 70 ? 'text-bear' : data.rsi < 30 ? 'text-bull' : 'text-text' },
    { label: 'MACD',   value: data.macd.toFixed(3),          color: data.macd > data.macd_signal ? 'text-bull' : 'text-bear' },
    { label: 'Signal', value: data.macd_signal.toFixed(3),   color: 'text-muted' },
    { label: 'VWAP',   value: `$${data.vwap.toFixed(2)}`,    color: data.current_price > data.vwap ? 'text-bull' : 'text-bear' },
    { label: 'IV%',    value: `${data.iv_percentile.toFixed(0)}%`, color: data.iv_percentile > 80 ? 'text-warn' : 'text-text' },
  ]
  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-surface border-b border-muted/20 overflow-x-auto flex-shrink-0">
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-muted text-xs">{label}</span>
          <span className={`text-xs font-semibold font-mono ${color}`}>{value}</span>
        </div>
      ))}
    </div>
  )
}

export function Dashboard() {
  const [ticker, setTicker]         = useState('AAPL')
  const [period, setPeriod]         = useState('5d')
  const [interval, setChartInterval] = useState('5m')
  const [bars, setBars]             = useState<CandlestickBar[]>([])
  const [technicals, setTechnicals] = useState<Technicals | null>(null)
  const [rightPanel, setRightPanel] = useState<RightPanel>('whatif')
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null)
  const [loading, setLoading]       = useState(false)
  const [view, setView]             = useState<ViewMode>('chart')

  const { price, lastBar, connected } = usePriceFeed(ticker)

  const loadData = useCallback(async (t: string, p: string, i: string) => {
    setBars([])
    setTechnicals(null)
    setLoading(true)
    try {
      const [candleRes, techRes] = await Promise.all([
        api.candles(t, p, i),
        api.technicals(t),
      ])
      setBars(candleRes.bars)
      setTechnicals(techRes.technicals)
    } catch (e) {
      console.error('Failed to load market data', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(ticker, period, interval)
  }, [ticker, period, interval, loadData])

  // When scanner selects a ticker, switch to chart view and load it
  function handleScannerSelect(t: string) {
    setTicker(t)
    setView('chart')
  }

  const currentPrice = price ?? technicals?.current_price ?? 0

  return (
    <div className="flex flex-col h-screen bg-base text-text font-mono overflow-hidden">
      <Header
        ticker={ticker}
        onTickerChange={setTicker}
        price={price}
        connected={connected}
        period={period}
        onPeriodChange={setPeriod}
        interval={interval}
        onIntervalChange={setChartInterval}
        view={view}
        onViewChange={setView}
      />

      {/* ── Market Pulse view ─────────────────────────────────────────── */}
      {view === 'market' && (
        <div className="flex-1 overflow-hidden">
          <MarketOverview onSelectTicker={handleScannerSelect} />
        </div>
      )}

      {/* ── Scanner view (full-width) ──────────────────────────────────── */}
      {view === 'scanner' && (
        <div className="flex-1 overflow-hidden">
          <StockScanner onSelectTicker={handleScannerSelect} />
        </div>
      )}

      {/* ── Chart view ────────────────────────────────────────────────── */}
      {view === 'chart' && (
        <>
          <TechnicalsBar data={technicals} />

          <div className="flex flex-1 overflow-hidden">
            {/* Left: AI Sidebar */}
            <aside className="w-72 bg-surface border-r border-muted/20 flex flex-col p-4 overflow-hidden flex-shrink-0">
              <AIAssistant ticker={ticker} />
            </aside>

            {/* Center: Chart + News */}
            <main className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 relative">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-base/60">
                    <div className="text-accent text-xs animate-pulse">Loading {ticker}…</div>
                  </div>
                )}
                <CandlestickChart
                  bars={bars}
                  ticker={ticker}
                  liveTick={loading ? null : lastBar}
                  onPriceSelect={setSelectedPrice}
                />
              </div>

              {/* Bottom: News */}
              <div className="h-52 border-t border-muted/20 bg-surface p-3 overflow-hidden">
                <NewsFeed ticker={ticker} />
              </div>
            </main>

            {/* Right: Risk / What-If */}
            <aside className="w-80 bg-surface border-l border-muted/20 flex flex-col flex-shrink-0 overflow-hidden">
              <div className="flex border-b border-muted/20 flex-shrink-0">
                {([
                  { id: 'whatif', label: 'What-If',  icon: <BarChart2   size={13} /> },
                  { id: 'risk',   label: 'Risk Mgr', icon: <ShieldCheck size={13} /> },
                ] as const).map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setRightPanel(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
                      rightPanel === id
                        ? 'text-accent border-b-2 border-accent bg-accent/5'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {rightPanel === 'whatif' && (
                  <WhatIfSimulator
                    currentPrice={selectedPrice ?? currentPrice}
                    ticker={ticker}
                  />
                )}
                {rightPanel === 'risk' && (
                  <RiskCalculator currentPrice={currentPrice} />
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
