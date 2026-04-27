import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import type { AISuggestion, Decision } from '../../types'
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, Zap } from 'lucide-react'

interface Props { ticker: string }

const DECISION_CONFIG: Record<Decision, { color: string; icon: React.ReactNode; bg: string }> = {
  BUY:           { color: 'text-bull',   bg: 'bg-bull/10 border-bull/30',     icon: <TrendingUp   size={18} /> },
  SELL:          { color: 'text-bear',   bg: 'bg-bear/10 border-bear/30',     icon: <TrendingDown size={18} /> },
  HOLD:          { color: 'text-warn',   bg: 'bg-warn/10 border-warn/30',     icon: <Minus        size={18} /> },
  CREDIT_SPREAD: { color: 'text-accent', bg: 'bg-accent/10 border-accent/30', icon: <TrendingUp   size={18} /> },
  AVOID:         { color: 'text-bear',   bg: 'bg-bear/10 border-bear/30',     icon: <AlertTriangle size={18} /> },
}

export function AIAssistant({ ticker }: Props) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [attempt, setAttempt]       = useState(0)
  const activeRef = useRef(false)

  useEffect(() => {
    setSuggestion(null)
    setError('')
  }, [ticker])

  // Auto-analyze on mount and ticker change
  useEffect(() => {
    if (ticker) fetchSuggestion()
  }, [ticker])

  async function fetchSuggestion() {
    if (!ticker || activeRef.current) return
    activeRef.current = true
    setLoading(true)
    setError('')
    setAttempt(0)

    // Retry up to 3 times to handle Render cold-start
    for (let i = 0; i < 3; i++) {
      setAttempt(i + 1)
      try {
        const s = await api.autoSuggest(ticker)
        setSuggestion(s)
        setError('')
        setLoading(false)
        activeRef.current = false
        return
      } catch {
        if (i < 2) await new Promise<void>(r => setTimeout(r, 5000))
      }
    }

    setError('Backend unreachable. Make sure it is running.')
    setLoading(false)
    activeRef.current = false
  }

  const cfg = suggestion ? DECISION_CONFIG[suggestion.decision] : null

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-accent" />
          <h2 className="text-xs font-semibold text-text uppercase tracking-widest">AI Assistant</h2>
        </div>
        <button
          onClick={fetchSuggestion}
          disabled={loading || !ticker}
          title="Re-analyze"
          className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Analyze button — shown when no result yet */}
      {!suggestion && !loading && !error && (
        <button
          onClick={fetchSuggestion}
          disabled={!ticker}
          className="flex items-center justify-center gap-2 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-40"
        >
          <Zap size={13} />
          Analyze {ticker || '—'}
        </button>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-2 py-6">
          <RefreshCw size={18} className="text-accent animate-spin" />
          <p className="text-muted text-xs">
            {attempt > 1 ? `Retrying… (${attempt}/3)` : `Analyzing ${ticker}…`}
          </p>
          {attempt > 1 && (
            <p className="text-muted text-xs text-center">Backend waking up,<br />please wait…</p>
          )}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-3">
          <AlertTriangle size={16} className="text-bear" />
          <p className="text-bear text-xs text-center">{error}</p>
          <button
            onClick={fetchSuggestion}
            className="text-xs text-accent border border-accent/30 px-3 py-1 rounded hover:bg-accent/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {suggestion && cfg && !loading && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
          {/* Decision badge */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${cfg.bg}`}>
            <span className={cfg.color}>{cfg.icon}</span>
            <div>
              <div className={`font-bold text-sm ${cfg.color}`}>{suggestion.decision}</div>
              <div className="text-muted text-xs">{suggestion.strategy.replace('_', ' ')}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-text text-xs font-semibold">{suggestion.confidence_level.toFixed(0)}%</div>
              <div className="text-muted text-xs">confidence</div>
            </div>
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-bull/10 border border-bull/20 rounded-lg p-2">
              <div className="text-muted">Target</div>
              <div className="text-bull font-bold text-sm">${suggestion.target.toFixed(2)}</div>
            </div>
            <div className="bg-bear/10 border border-bear/20 rounded-lg p-2">
              <div className="text-muted">Stop Loss</div>
              <div className="text-bear font-bold text-sm">${suggestion.stop_loss.toFixed(2)}</div>
            </div>
          </div>

          {/* R/R */}
          <div className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-xs">
            <span className="text-muted">Risk / Reward</span>
            <span className={`font-bold ${suggestion.risk_reward_ratio >= 2 ? 'text-bull' : 'text-warn'}`}>
              1 : {suggestion.risk_reward_ratio.toFixed(2)}
            </span>
          </div>

          {/* Confidence bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted">
              <span>Confidence</span>
              <span>{suggestion.confidence_level.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${suggestion.confidence_level}%` }}
              />
            </div>
          </div>

          {/* Reasoning */}
          <div className="space-y-1">
            <div className="text-xs text-muted uppercase tracking-widest">Reasoning</div>
            <ul className="space-y-1.5">
              {suggestion.reasoning.map((r, i) => (
                <li key={i} className="text-xs text-text bg-surface rounded px-2 py-1.5 border-l-2 border-accent/40">
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Re-analyze button at bottom */}
          <button
            onClick={fetchSuggestion}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-muted/20 text-muted text-xs hover:text-accent hover:border-accent/30 transition-colors mt-auto"
          >
            <RefreshCw size={11} /> Re-analyze
          </button>
        </div>
      )}
    </div>
  )
}
