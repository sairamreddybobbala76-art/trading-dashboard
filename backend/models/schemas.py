from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class Decision(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    CREDIT_SPREAD = "CREDIT_SPREAD"
    AVOID = "AVOID"


class StrategyType(str, Enum):
    MOMENTUM = "MOMENTUM"
    MEAN_REVERSION = "MEAN_REVERSION"
    BREAKOUT = "BREAKOUT"
    OPTIONS = "OPTIONS"


class TechnicalData(BaseModel):
    rsi: float
    macd: float
    macd_signal: float
    vwap: float
    current_price: float
    iv_percentile: float = 50.0


class SentimentData(BaseModel):
    headlines: List[str] = []
    social_score: float = 0.0  # -1 to 1


class WhaleFlow(BaseModel):
    direction: str = "neutral"  # bullish, bearish, neutral
    volume_ratio: float = 1.0   # unusual volume multiplier
    net_flow: float = 0.0       # net call/put dollar flow


class AIEnginePayload(BaseModel):
    ticker: str
    technical: TechnicalData
    sentiment: Optional[SentimentData] = None
    whale_flow: Optional[WhaleFlow] = None
    high_impact_event: bool = False


class AISuggestion(BaseModel):
    ticker: str
    decision: Decision
    strategy: StrategyType
    target: float
    stop_loss: float
    confidence_level: float  # 0-100
    reasoning: List[str]
    risk_reward_ratio: float


class RiskRequest(BaseModel):
    portfolio_value: float
    entry_price: float
    stop_loss_price: float
    risk_percent: float = 2.0


class RiskResult(BaseModel):
    shares: int
    risk_amount: float
    position_size: float
    potential_loss: float
    risk_reward_ratio: Optional[float] = None


class CandlestickBar(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class NewsItem(BaseModel):
    title: str
    source: str
    url: str
    published: str
    sentiment: float  # -1 to 1
