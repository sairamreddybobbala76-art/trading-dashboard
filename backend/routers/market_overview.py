from fastapi import APIRouter
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor
import time

router = APIRouter(prefix="/api/market", tags=["overview"])

SPY_TOP10 = [
    ("AAPL",  "Apple",       6.9),
    ("MSFT",  "Microsoft",   6.4),
    ("NVDA",  "NVIDIA",      5.9),
    ("AMZN",  "Amazon",      3.9),
    ("META",  "Meta",        2.6),
    ("GOOGL", "Alphabet A",  2.1),
    ("TSLA",  "Tesla",       1.9),
    ("BRK-B", "Berkshire B", 1.7),
    ("JPM",   "JPMorgan",    1.5),
    ("UNH",   "UnitedHealth",1.3),
]

SECTORS = [
    ("Tech",       "XLK"),
    ("Finance",    "XLF"),
    ("Energy",     "XLE"),
    ("Health",     "XLV"),
    ("Consumer",   "XLY"),
    ("Industrial", "XLI"),
    ("Utilities",  "XLU"),
    ("Materials",  "XLB"),
]

INDICES = ["SPY", "QQQ", "^VIX", "IWM", "DIA"]


def fetch_quote(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        price      = round(float(info.last_price), 2)
        prev_close = round(float(info.previous_close), 2)
        change     = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0.0
        day_high   = round(float(info.day_high), 2)
        day_low    = round(float(info.day_low), 2)
        try:
            volume = int(info.last_volume)
        except Exception:
            volume = 0
        return {
            "ticker":     ticker,
            "price":      price,
            "prev_close": prev_close,
            "change":     change,
            "change_pct": change_pct,
            "day_high":   day_high,
            "day_low":    day_low,
            "volume":     volume,
            "direction":  "up" if change > 0 else "down" if change < 0 else "flat",
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "price": 0, "change": 0,
                "change_pct": 0, "direction": "flat"}


@router.get("/overview")
def market_overview():
    all_tickers = INDICES + [t for t, _, _ in SPY_TOP10] + [etf for _, etf in SECTORS]
    with ThreadPoolExecutor(max_workers=16) as ex:
        results = list(ex.map(fetch_quote, all_tickers))

    quotes = {r["ticker"]: r for r in results}

    indices_data = [quotes.get(t, {"ticker": t}) for t in INDICES]

    vix_raw = quotes.get("^VIX", {})
    vix_val = vix_raw.get("price", 0)
    if vix_val < 15:
        vix_zone, vix_color = "Low Fear", "bull"
    elif vix_val < 25:
        vix_zone, vix_color = "Moderate", "warn"
    else:
        vix_zone, vix_color = "High Fear", "bear"

    spy = quotes.get("SPY", {})
    spy_chg = spy.get("change_pct", 0)
    market_bias = "BULLISH" if spy_chg > 0.3 else "BEARISH" if spy_chg < -0.3 else "NEUTRAL"

    top10_data = []
    for ticker, company, weight in SPY_TOP10:
        q = quotes.get(ticker, {"ticker": ticker})
        top10_data.append({**q, "company": company, "spy_weight": weight})

    sectors_data = []
    for name, etf in SECTORS:
        q = quotes.get(etf, {"ticker": etf})
        sectors_data.append({**q, "name": name, "etf": etf})

    # Breadth: how many top-10 are up
    up_count   = sum(1 for s in top10_data if s.get("direction") == "up")
    down_count = sum(1 for s in top10_data if s.get("direction") == "down")

    return {
        "indices":      indices_data,
        "vix":          {**vix_raw, "zone": vix_zone, "color": vix_color},
        "top10":        top10_data,
        "sectors":      sectors_data,
        "market_bias":  market_bias,
        "breadth":      {"up": up_count, "down": down_count, "total": len(top10_data)},
        "timestamp":    int(time.time()),
    }
