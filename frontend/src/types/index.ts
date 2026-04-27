export interface CandlestickBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Technicals {
  rsi: number
  macd: number
  macd_signal: number
  vwap: number
  current_price: number
  iv_percentile: number
}

export type Decision = 'BUY' | 'SELL' | 'HOLD' | 'CREDIT_SPREAD' | 'AVOID'
export type Strategy = 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT' | 'OPTIONS'

export interface AISuggestion {
  ticker: string
  decision: Decision
  strategy: Strategy
  target: number
  stop_loss: number
  confidence_level: number
  reasoning: string[]
  risk_reward_ratio: number
}

export interface RiskResult {
  shares: number
  risk_amount: number
  position_size: number
  potential_loss: number
}

export interface NewsItem {
  title: string
  source: string
  url: string
  published: string
  sentiment: number
}

export interface TickMessage {
  type: 'tick'
  ticker: string
  price: number
  time: number
}

// ── Scanner ────────────────────────────────────────────────────────────────
export type TradeType = 'DAY_TRADE' | 'WEEKLY_TRADE' | 'WATCH'
export type ScanDecision = 'BUY' | 'SHORT' | 'HOLD' | 'AVOID'

export interface ScanScores {
  technical: number
  momentum: number
  sentiment: number
  whale: number
  target: number
}

export interface ScanTechnicals {
  rsi: number
  macd_bull: boolean
  macd_cross: boolean
  vwap: number
  sma20: number
  sma50: number
  above_vwap: boolean
  above_sma20: boolean
  above_sma50: boolean
  bb_position: number
  atr: number
  atr_pct: number
  iv_pct: number
  hi52: number
  lo52: number
}

export interface ScanMomentum {
  day_chg: number
  week_chg: number
  month_chg: number
  vol_ratio: number
  vol_today: number
  vol_avg: number
}

export interface ScanSentiment {
  news_score: number
  social_bull_pct: number
  social_bullish: number
  social_bearish: number
  social_total: number
  headlines: string[]
}

export interface ScanWhale {
  put_call_ratio: number
  call_vol: number
  put_vol: number
  unusual: boolean
  vol_ratio: number
}

export interface ScanTrade {
  entry: number
  target: number
  stop_loss: number
  rr_ratio: number
  atr: number
}

export interface ScanResult {
  ticker: string
  company: string
  price: number
  change_pct: number
  week_chg: number
  month_chg: number
  composite: number
  trade_type: TradeType
  decision: ScanDecision
  scores: ScanScores
  technicals: ScanTechnicals
  momentum: ScanMomentum
  sentiment: ScanSentiment
  whale: ScanWhale
  trade: ScanTrade
  reasons: string[]
}

export interface ScanResponse {
  scanned: number
  scan_time: string
  cached: boolean
  top_overall: ScanResult[]
  day_trades: ScanResult[]
  weekly_trades: ScanResult[]
}
