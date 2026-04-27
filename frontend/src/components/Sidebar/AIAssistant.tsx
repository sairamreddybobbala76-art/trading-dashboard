import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import type { AISuggestion, Decision } from '../../types'
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  ticker: string
}

const DECISION_CONFIG: Record<Decision, { color: string; icon: React.ReactNode; bg: string }> = {
  BUY: { color: 'text-bull', bg: 'bg-bull/10 border-bull/30', icon: <TrendingUp size={18} /> },
  SELL: { color: 'text-bear', bg: 'bg-bear/10 border-bear/30', icon: <TrendingDown size={18} /> },
  HOLD: { color: 'text-warn', bg: 'bg-warn/10 border-warn/30', icon: <Minus size={18} /> },
  CREDIT_SPREAD: { color: 'text-accent', bg: 'bg-accent/10 border-accent/30', icon: <TrendingUp size={18} /> },
  AVOID: { color: 'text-bear', bg: 'bg-bear/10 border-bear/30', icon: <AlertTriangle size={18} /> },
}

export function AIAssistant({ ticker }: Props) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Clear stale result when user switches ticker
  useEffect(() => {
    setSuggestion(null)
    setError('')
  }, [ticker])

  async function fetchSuggestion() {
    if (!ticker) return
    setLoading(true)
    setError('')
    try {
      const s = await api.autoSuggest(ticker)
      setSuggestion(s)
    } catch (e) {
      setError('Failed to fetch AI suggestion. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const cfg = suggestion ? DECISION_CONFIG[suggestion.decision] : null

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-accent" />
        <h2 className="text-sm font-semibold text-text uppercase tracking-widest">AI Trading Assistant</h2>
      </div>

      <button
        onClick={fetchSuggestion}
        disabled={loading || !ticker}
        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-40"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Analyzing...' : `Analyze ${ticker || '—'}`}
      </button>

      {error && <p className="text-bear text-xs">{error}</p>}

      {suggestion && cfg && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
          {/* Decision Badge */}
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

          {/* Confidence Bar */}
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
        </div>
      )}

      {!suggestion && !loading && (
        <div className="flex-1 flex items-center justify-center text-muted text-xs text-center">
          Click "Analyze" to get an<br />AI-powered trade suggestion
        </div>
      )}
    </div>
  )
}
