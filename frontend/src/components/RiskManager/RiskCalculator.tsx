import { useState } from 'react'
import { api } from '../../services/api'
import type { RiskResult } from '../../types'
import { Shield } from 'lucide-react'

interface Props {
  currentPrice?: number
}

export function RiskCalculator({ currentPrice = 100 }: Props) {
  const [portfolio, setPortfolio] = useState(10000)
  const [entry, setEntry] = useState(currentPrice)
  const [stopLoss, setStopLoss] = useState(currentPrice * 0.98)
  const [riskPct, setRiskPct] = useState(2)
  const [result, setResult] = useState<RiskResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function calculate() {
    setLoading(true)
    try {
      const r = await api.calculateRisk(portfolio, entry, stopLoss, riskPct)
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  const riskPerShare = Math.abs(entry - stopLoss)
  const riskDollars = portfolio * (riskPct / 100)

  return (
    <div className="bg-panel rounded-xl p-4 border border-muted/20 space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-accent" />
        <h3 className="text-sm font-semibold text-text uppercase tracking-widest">Risk Manager</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-muted">Portfolio ($)</span>
          <input type="number" value={portfolio}
            onChange={(e) => setPortfolio(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Risk %</span>
          <input type="number" step="0.5" min="0.5" max="10" value={riskPct}
            onChange={(e) => setRiskPct(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Entry Price ($)</span>
          <input type="number" step="0.01" value={entry}
            onChange={(e) => setEntry(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Stop Loss ($)</span>
          <input type="number" step="0.01" value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent" />
        </label>
      </div>

      <div className="flex justify-between text-xs text-muted bg-surface rounded px-3 py-2">
        <span>Risk per share: <span className="text-bear">${riskPerShare.toFixed(2)}</span></span>
        <span>Max risk: <span className="text-bear">${riskDollars.toFixed(2)}</span></span>
      </div>

      <button
        onClick={calculate}
        disabled={loading}
        className="w-full py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50"
      >
        {loading ? 'Calculating...' : 'Calculate Position'}
      </button>

      {result && (
        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          {[
            { label: 'Shares to Buy', value: result.shares.toString(), color: 'text-bull' },
            { label: 'Position Size', value: `$${result.position_size.toLocaleString()}`, color: 'text-text' },
            { label: 'Risk Amount', value: `$${result.risk_amount.toFixed(2)}`, color: 'text-bear' },
            { label: 'Max Loss', value: `$${result.potential_loss.toFixed(2)}`, color: 'text-bear' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface rounded p-2">
              <div className="text-muted">{label}</div>
              <div className={`${color} font-bold text-sm`}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
