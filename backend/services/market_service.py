import yfinance as yf
import pandas as pd
import numpy as np
from typing import List, Optional
from models.schemas import CandlestickBar, TechnicalData

try:
    import ta
    TA_AVAILABLE = True
except ImportError:
    TA_AVAILABLE = False


def get_candlestick_data(ticker: str, period: str = "5d", interval: str = "5m") -> List[dict]:
    stock = yf.Ticker(ticker)
    df = stock.history(period=period, interval=interval)
    if df.empty:
        return []

    bars = []
    for ts, row in df.iterrows():
        timestamp = int(ts.timestamp())
        bars.append({
            "time": timestamp,
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": round(float(row["Volume"]), 0),
        })
    return bars


def get_current_price(ticker: str) -> Optional[float]:
    stock = yf.Ticker(ticker)
    info = stock.fast_info
    try:
        return round(float(info.last_price), 2)
    except Exception:
        return None


def compute_technicals(ticker: str) -> TechnicalData:
    stock = yf.Ticker(ticker)
    df = stock.history(period="3mo", interval="1d")

    if df.empty or len(df) < 20:
        price = get_current_price(ticker) or 100.0
        return TechnicalData(
            rsi=50.0, macd=0.0, macd_signal=0.0,
            vwap=price, current_price=price, iv_percentile=50.0
        )

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]

    # RSI (14-period)
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = float((100 - 100 / (1 + rs)).iloc[-1])

    # MACD (12/26/9)
    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9).mean()
    macd = float(macd_line.iloc[-1])
    macd_signal = float(signal_line.iloc[-1])

    # VWAP (rolling 20-day approximation)
    typical = (high + low + close) / 3
    vwap = float((typical * volume).rolling(20).sum().iloc[-1] / volume.rolling(20).sum().iloc[-1])

    # IV Percentile stub — real IV needs options chain data
    hist_vol = float(close.pct_change().rolling(30).std().iloc[-1] * np.sqrt(252) * 100)
    iv_percentile = min(100.0, max(0.0, hist_vol * 1.5))

    current_price = float(close.iloc[-1])

    return TechnicalData(
        rsi=round(rsi, 2),
        macd=round(macd, 4),
        macd_signal=round(macd_signal, 4),
        vwap=round(vwap, 2),
        current_price=round(current_price, 2),
        iv_percentile=round(iv_percentile, 2),
    )
