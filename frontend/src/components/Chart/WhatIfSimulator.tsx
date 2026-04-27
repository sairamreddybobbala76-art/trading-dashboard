import { useState } from 'react'
import { api } from '../../services/api'
import type { RiskResult } from '../../types'

interface Props {
  currentPrice: number
  ticker: string
}

export function WhatIfSimulator({ currentPrice, ticker }: Props) {
  const [target, setTarget] = useState(currentPrice)
  const [stopLoss, setStopLoss] = useState(currentPrice * 0.98)
  const [portfolio, setPortfolio] = useState(10000)
  const [shares, setShares] = useState(1)
  const [result, setResult] = useState<RiskResult | null>(null)
  const [loading, setLoading] = useState(false)

  const pnl = (target - currentPrice) * shares
  const pnlPct = ((target - currentPrice) / currentPrice) * 100
  const downside = (stopLoss - currentPrice) * shares

  async function calcRisk() {
    setLoading(true)
    try {
      const r = await api.calculateRisk(portfolio, currentPrice, stopLoss)
      setResult(r)
      setShares(r.shares)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-panel rounded-xl p-4 border border-muted/20 space-y-4">
      <h3 className="text-sm font-semibold text-text uppercase tracking-widest">What-If Simulator</h3>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-muted">Portfolio ($)</span>
          <input
            type="number"
            value={portfolio}
            onChange={(e) => setPortfolio(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Shares</span>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Price Target ($)</span>
          <input
            type="number"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Stop Loss ($)</span>
          <input
            type="number"
            step="0.01"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
            className="bg-surface border border-muted/30 rounded px-2 py-1 text-text focus:outline-none focus:border-accent"
          />
        </label>
      </div>

      {/* Visual P&L Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className={pnl >= 0 ? 'text-bull' : 'text-bear'}>
            P&L: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct.toFixed(2)}%)
          </span>
          <span className="text-bear">Max Loss: ${downside.toFixed(2)}</span>
        </div>
        <div className="relative h-2 bg-surface rounded-full overflow-hidden">
          <div
            className={`absolute left-1/2 top-0 h-full rounded-full transition-all ${pnl >= 0 ? 'bg-bull' : 'bg-bear'}`}
            style={{ width: `${Math.min(Math.abs(pnlPct) * 2, 50)}%`, left: pnl >= 0 ? '50%' : `${50 - Math.min(Math.abs(pnlPct) * 2, 50)}%` }}
          />
        </div>
      </div>

      <button
        onClick={calcRisk}
        disabled={loading}
        className="w-full py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50"
      >
        {loading ? 'Calculating...' : 'Calculate 2% Risk Position'}
      </button>

      {result && (
        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="bg-surface rounded p-2">
            <div className="text-muted">Shares (2% risk)</div>
            <div className="text-text font-bold text-base">{result.shares}</div>
          </div>
          <div className="bg-surface rounded p-2">
            <div className="text-muted">Position Size</div>
            <div className="text-text font-bold">${result.position_size.toLocaleString()}</div>
          </div>
          <div className="bg-surface rounded p-2">
            <div className="text-muted">Risk Amount</div>
            <div className="text-bear font-bold">${result.risk_amount.toFixed(2)}</div>
          </div>
          <div className="bg-surface rounded p-2">
            <div className="text-muted">Max Loss</div>
            <div className="text-bear font-bold">${result.potential_loss.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
