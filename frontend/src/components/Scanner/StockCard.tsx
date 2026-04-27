import type { ScanResult, ScanDecision, TradeType } from '../../types'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, Calendar } from 'lucide-react'

interface Props {
  stock: ScanResult
  rank: number
  onSelect: (ticker: string) => void
}

// ── Config maps ───────────────────────────────────────────────────────────────

const DECISION_CFG: Record<ScanDecision, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  BUY:   { label: 'BUY',   color: 'text-bull',   bg: 'bg-bull/10',   border: 'border-bull/40',   icon: <TrendingUp  size={12} /> },
  SHORT: { label: 'SHORT', color: 'text-bear',   bg: 'bg-bear/10',   border: 'border-bear/40',   icon: <TrendingDown size={12} /> },
  HOLD:  { label: 'WATCH', color: 'text-warn',   bg: 'bg-warn/10',   border: 'border-warn/40',   icon: <Minus        size={12} /> },
  AVOID: { label: 'AVOID', color: 'text-muted',  bg: 'bg-muted/10',  border: 'border-muted/30',  icon: <AlertTriangle size={12} /> },
}

const TRADE_CFG: Record<TradeType, { label: string; icon: React.ReactNode; color: string }> = {
  DAY_TRADE:    { label: 'DAY TRADE',  icon: <Zap      size={10} />, color: 'text-accent' },
  WEEKLY_TRADE: { label: 'WEEKLY',     icon: <Calendar size={10} />, color: 'text-[#a78bfa]' },
  WATCH:        { label: 'WATCH LIST', icon: <Minus    size={10} />, color: 'text-warn' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color = 'bg-accent' }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted">{label}</span>
        <span className="text-text font-semibold">{value.toFixed(0)}</span>
      </div>
      <div className="h-1 bg-base rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function CompositeRing({ score }: { score: number }) {
  const r = 24
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 70 ? '#26a69a' : score >= 55 ? '#ffb74d' : '#ef5350'
  return (
    <svg width="64" height="64" className="rotate-[-90deg]">
      <circle cx="32" cy="32" r={r} stroke="#1e2d35" strokeWidth="5" fill="none" />
      <circle
        cx="32" cy="32" r={r}
        stroke={color} strokeWidth="5" fill="none"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
      />
      <text
        x="32" y="36"
        textAnchor="middle"
        className="rotate-90"
        style={{ transform: 'rotate(90deg)', transformOrigin: '32px 32px', fill: color, fontSize: '13px', fontWeight: 700 }}
      >
        {score.toFixed(0)}
      </text>
    </svg>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function StockCard({ stock, rank, onSelect }: Props) {
  const dcfg = DECISION_CFG[stock.decision]
  const tcfg = TRADE_CFG[stock.trade_type]
  const isUp = stock.change_pct >= 0

  const scoreColors: Record<string, string> = {
    technical: 'bg-[#38bdf8]',
    momentum:  stock.scores.momentum >= 60 ? 'bg-bull' : 'bg-bear',
    sentiment: 'bg-[#a78bfa]',
    whale:     'bg-[#fb923c]',
    target:    'bg-accent',
  }

  return (
    <div
      className={`relative bg-panel rounded-xl border ${dcfg.border} flex flex-col gap-0 overflow-hidden cursor-pointer
                  hover:border-opacity-80 hover:shadow-lg hover:shadow-black/30 transition-all group`}
      onClick={() => onSelect(stock.ticker)}
    >
      {/* Rank strip */}
      <div className="absolute top-0 left-0 w-1 h-full opacity-60"
           style={{ background: stock.composite >= 70 ? '#26a69a' : stock.composite >= 55 ? '#ffb74d' : '#ef5350' }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="pl-3 pr-3 pt-3 pb-2 flex items-start gap-3">
        {/* Rank + ring */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted">#{rank}</span>
          <CompositeRing score={stock.composite} />
        </div>

        {/* Ticker info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-text font-bold text-base">{stock.ticker}</span>
            {/* Trade type badge */}
            <span className={`flex items-center gap-1 text-[10px] font-semibold ${tcfg.color}`}>
              {tcfg.icon}{tcfg.label}
            </span>
          </div>
          <p className="text-muted text-[10px] truncate">{stock.company}</p>

          {/* Price row */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-text font-bold text-sm">${stock.price.toFixed(2)}</span>
            <span className={`text-xs font-semibold ${isUp ? 'text-bull' : 'text-bear'}`}>
              {isUp ? '+' : ''}{stock.change_pct.toFixed(2)}%
            </span>
            <span className="text-muted text-[10px]">1d</span>
            <span className={`text-[10px] ${stock.week_chg >= 0 ? 'text-bull' : 'text-bear'}`}>
              {stock.week_chg >= 0 ? '+' : ''}{stock.week_chg.toFixed(1)}% 1w
            </span>
          </div>
        </div>

        {/* Decision badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${dcfg.color} ${dcfg.bg} border ${dcfg.border} flex-shrink-0`}>
          {dcfg.icon} {dcfg.label}
        </div>
      </div>

      {/* ── Score bars ─────────────────────────────────────────────────── */}
      <div className="px-3 pb-2 space-y-1.5">
        <ScoreBar label="Technical"  value={stock.scores.technical}  color={scoreColors.technical} />
        <ScoreBar label="Momentum"   value={stock.scores.momentum}   color={scoreColors.momentum} />
        <ScoreBar label="Sentiment"  value={stock.scores.sentiment}  color={scoreColors.sentiment} />
        <ScoreBar label="Whale Flow" value={stock.scores.whale}      color={scoreColors.whale} />
        <ScoreBar label="Risk/Reward" value={stock.scores.target}    color={scoreColors.target} />
      </div>

      {/* ── Metrics pills ──────────────────────────────────────────────── */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        <Pill label="RSI" value={stock.technicals.rsi.toFixed(0)}
              color={stock.technicals.rsi < 35 ? 'text-bull' : stock.technicals.rsi > 65 ? 'text-bear' : 'text-text'} />
        <Pill label="Vol" value={`${stock.momentum.vol_ratio.toFixed(1)}×`}
              color={stock.momentum.vol_ratio > 2 ? 'text-warn' : 'text-text'} />
        <Pill label="IV%"  value={`${stock.technicals.iv_pct.toFixed(0)}%`}
              color={stock.technicals.iv_pct > 80 ? 'text-bear' : 'text-text'} />
        <Pill label="P/C"  value={stock.whale.put_call_ratio.toFixed(2)}
              color={stock.whale.put_call_ratio < 0.5 ? 'text-bull' : stock.whale.put_call_ratio > 1.5 ? 'text-bear' : 'text-text'} />
        <Pill label="MACD" value={stock.technicals.macd_bull ? '▲' : '▼'}
              color={stock.technicals.macd_bull ? 'text-bull' : 'text-bear'} />
        {stock.technicals.above_vwap
          ? <Pill label="VWAP" value="Above" color="text-bull" />
          : <Pill label="VWAP" value="Below" color="text-bear" />}
      </div>

      {/* ── Trade plan ────────────────────────────────────────────────── */}
      <div className="mx-3 mb-2 grid grid-cols-3 gap-1 bg-base rounded-lg p-2 text-center text-[10px]">
        <div>
          <div className="text-muted">Entry</div>
          <div className="text-text font-semibold">${stock.trade.entry.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-muted">Target</div>
          <div className="text-bull font-semibold">${stock.trade.target.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-muted">Stop</div>
          <div className="text-bear font-semibold">${stock.trade.stop_loss.toFixed(2)}</div>
        </div>
        <div className="col-span-3 mt-1 text-muted">
          R:R <span className={`font-bold ${stock.trade.rr_ratio >= 2 ? 'text-bull' : 'text-warn'}`}>
            1:{stock.trade.rr_ratio.toFixed(1)}
          </span>
          <span className="ml-2">ATR <span className="text-text">${stock.trade.atr.toFixed(2)}</span></span>
        </div>
      </div>

      {/* ── Social sentiment ──────────────────────────────────────────── */}
      {stock.sentiment.social_total > 0 && (
        <div className="mx-3 mb-2">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-muted">People Pulse</span>
            <span className={stock.sentiment.social_bull_pct >= 50 ? 'text-bull' : 'text-bear'}>
              {stock.sentiment.social_bull_pct}% bullish
            </span>
          </div>
          <div className="h-1.5 bg-base rounded-full overflow-hidden flex">
            <div className="h-full bg-bull rounded-l-full" style={{ width: `${stock.sentiment.social_bull_pct}%` }} />
            <div className="h-full bg-bear rounded-r-full flex-1" />
          </div>
          <div className="flex justify-between text-[9px] text-muted mt-0.5">
            <span>{stock.sentiment.social_bullish} bulls</span>
            <span>{stock.sentiment.social_bearish} bears</span>
          </div>
        </div>
      )}

      {/* ── AI Reasoning ──────────────────────────────────────────────── */}
      <div className="px-3 pb-3 space-y-1">
        {stock.reasons.slice(0, 4).map((r, i) => (
          <div key={i} className="flex gap-1.5 text-[10px] text-text/80 leading-snug">
            <span className="text-accent flex-shrink-0 mt-0.5">›</span>
            <span>{r}</span>
          </div>
        ))}
      </div>

      {/* Click hint */}
      <div className="absolute bottom-2 right-3 text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
        Click to open chart →
      </div>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1 bg-base rounded px-1.5 py-0.5 text-[10px]">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}
