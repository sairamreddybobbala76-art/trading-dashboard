"""
AI Stock Scanner — scores 30 high-liquidity stocks across 5 dimensions:
  Technical (RSI, MACD, VWAP, Bollinger, SMA)
  Momentum  (day/week/month return, volume surge)
  Sentiment (Yahoo RSS news + StockTwits social pulse)
  Whale     (options put/call ratio, unusual volume)
  Target    (ATR-based risk/reward proxy)

Results cached for 2 minutes to avoid redundant yfinance calls.
"""
import concurrent.futures
import time
from typing import Optional
import yfinance as yf
import numpy as np
import requests
import feedparser

# ── Watchlist ─────────────────────────────────────────────────────────────────
WATCHLIST = [
    "AAPL", "NVDA", "TSLA", "AMD", "META", "MSFT", "GOOGL", "AMZN",
    "PLTR", "COIN", "SOFI", "HOOD", "RIVN", "NIO",
    "JPM", "BAC", "GS", "XOM",
    "NFLX", "DIS", "UBER", "SNAP",
    "SPY", "QQQ", "F", "GM",
    "UNH", "COST", "PYPL", "BABA",
]

COMPANY_NAMES: dict[str, str] = {
    "AAPL": "Apple Inc.", "NVDA": "NVIDIA Corp.", "TSLA": "Tesla Inc.",
    "AMD": "Advanced Micro Devices", "META": "Meta Platforms", "MSFT": "Microsoft Corp.",
    "GOOGL": "Alphabet Inc.", "AMZN": "Amazon.com Inc.", "PLTR": "Palantir Technologies",
    "COIN": "Coinbase Global", "SOFI": "SoFi Technologies", "HOOD": "Robinhood Markets",
    "RIVN": "Rivian Automotive", "NIO": "NIO Inc.", "JPM": "JPMorgan Chase",
    "BAC": "Bank of America", "GS": "Goldman Sachs", "XOM": "ExxonMobil Corp.",
    "NFLX": "Netflix Inc.", "DIS": "Walt Disney Co.", "UBER": "Uber Technologies",
    "SNAP": "Snap Inc.", "SPY": "SPDR S&P 500 ETF", "QQQ": "Invesco QQQ Trust",
    "F": "Ford Motor Co.", "GM": "General Motors", "UNH": "UnitedHealth Group",
    "COST": "Costco Wholesale", "PYPL": "PayPal Holdings", "BABA": "Alibaba Group",
}

BULLISH_WORDS = {
    "beat", "upgrade", "growth", "profit", "surge", "breakout", "strong",
    "record", "rally", "rise", "gain", "partnership", "deal", "launch",
    "buy", "bull", "outperform", "approval", "expands", "wins",
}
BEARISH_WORDS = {
    "crash", "recession", "fraud", "downgrade", "miss", "loss", "fear",
    "warning", "risk", "fall", "drop", "lawsuit", "recall", "probe",
    "short", "decline", "weak", "investigation", "default", "layoffs",
}

# ── Cache ─────────────────────────────────────────────────────────────────────
_scan_cache: Optional[dict] = None
_scan_cache_time: float = 0.0
CACHE_TTL = 120  # seconds


# ── Data fetchers ─────────────────────────────────────────────────────────────

def _news_headlines(ticker: str) -> list[str]:
    try:
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
        feed = feedparser.parse(url)
        return [e.get("title", "") for e in feed.entries[:10]]
    except Exception:
        return []


def _news_score(headlines: list[str]) -> float:
    """Returns -1.0 (very bearish) to 1.0 (very bullish)."""
    score = 0.0
    for h in headlines:
        lower = h.lower()
        score += sum(1 for w in BULLISH_WORDS if w in lower)
        score -= sum(1 for w in BEARISH_WORDS if w in lower)
    return max(-1.0, min(1.0, score / max(len(headlines), 1)))


def _stocktwits(ticker: str) -> dict:
    try:
        url = f"https://api.stocktwits.com/api/2/streams/symbol/{ticker}.json"
        r = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code != 200:
            return {"score": 0.5, "bullish": 0, "bearish": 0, "total": 0}
        msgs = r.json().get("messages", [])
        bull = sum(1 for m in msgs if m.get("entities", {}).get("sentiment", {}).get("basic") == "Bullish")
        bear = sum(1 for m in msgs if m.get("entities", {}).get("sentiment", {}).get("basic") == "Bearish")
        total = bull + bear
        return {"score": bull / total if total else 0.5, "bullish": bull, "bearish": bear, "total": total}
    except Exception:
        return {"score": 0.5, "bullish": 0, "bearish": 0, "total": 0}


def _options_flow(ticker: str) -> dict:
    default = {"put_call_ratio": 1.0, "call_vol": 0, "put_vol": 0, "unusual": False}
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(_fetch_options_chain, ticker)
            return fut.result(timeout=6)
    except Exception:
        return default


def _fetch_options_chain(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        exps = stock.options
        if not exps:
            return {"put_call_ratio": 1.0, "call_vol": 0, "put_vol": 0, "unusual": False}
        chain = stock.option_chain(exps[0])
        call_vol = float(chain.calls["volume"].fillna(0).sum())
        put_vol = float(chain.puts["volume"].fillna(0).sum())
        total = call_vol + put_vol
        if total == 0:
            return {"put_call_ratio": 1.0, "call_vol": 0, "put_vol": 0, "unusual": False}
        pcr = put_vol / max(call_vol, 1)
        return {
            "put_call_ratio": round(pcr, 2),
            "call_vol": int(call_vol),
            "put_vol": int(put_vol),
            "unusual": pcr < 0.4 or pcr > 2.0,
        }
    except Exception:
        return {"put_call_ratio": 1.0, "call_vol": 0, "put_vol": 0, "unusual": False}


# ── Per-stock analysis ────────────────────────────────────────────────────────

def _analyze(ticker: str) -> Optional[dict]:
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="3mo", interval="1d")
        if df.empty or len(df) < 22:
            return None

        close = df["Close"]
        high  = df["High"]
        low   = df["Low"]
        vol   = df["Volume"]

        cur   = float(close.iloc[-1])
        prev  = float(close.iloc[-2])

        # ── Returns ───────────────────────────────────────────────────────────
        day_chg   = (cur - prev) / prev * 100
        week_chg  = (cur - float(close.iloc[-6])) / float(close.iloc[-6]) * 100  if len(close) >= 6  else 0.0
        month_chg = (cur - float(close.iloc[-22])) / float(close.iloc[-22]) * 100 if len(close) >= 22 else 0.0

        # ── RSI 14 ────────────────────────────────────────────────────────────
        delta = close.diff()
        gain  = delta.clip(lower=0).rolling(14).mean()
        loss  = (-delta.clip(upper=0)).rolling(14).mean()
        rsi   = float((100 - 100 / (1 + gain / loss.replace(0, np.nan))).iloc[-1])

        # ── MACD ──────────────────────────────────────────────────────────────
        macd_line = close.ewm(span=12).mean() - close.ewm(span=26).mean()
        sig_line  = macd_line.ewm(span=9).mean()
        macd      = float(macd_line.iloc[-1])
        macd_sig  = float(sig_line.iloc[-1])
        macd_bull = macd > macd_sig
        macd_cross = macd_bull and float(macd_line.iloc[-2] - sig_line.iloc[-2]) <= 0

        # ── Moving averages ───────────────────────────────────────────────────
        sma20 = float(close.rolling(20).mean().iloc[-1])
        sma50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else sma20

        # ── VWAP (20-day rolling) ─────────────────────────────────────────────
        typ  = (high + low + close) / 3
        vwap = float((typ * vol).rolling(20).sum().iloc[-1] / vol.rolling(20).sum().iloc[-1])

        # ── Bollinger Bands ───────────────────────────────────────────────────
        bb_std = float(close.rolling(20).std().iloc[-1])
        bb_up  = sma20 + 2 * bb_std
        bb_lo  = sma20 - 2 * bb_std
        bb_pos = (cur - bb_lo) / (bb_up - bb_lo) if (bb_up - bb_lo) > 0 else 0.5

        # ── ATR 14 ────────────────────────────────────────────────────────────
        prev_close = close.shift(1)
        tr  = np.maximum(high - low,
              np.maximum(abs(high - prev_close), abs(low - prev_close)))
        atr = float(tr.rolling(14).mean().iloc[-1])

        # ── Volume ────────────────────────────────────────────────────────────
        avg_vol    = float(vol.rolling(20).mean().iloc[-1])
        today_vol  = float(vol.iloc[-1])
        vol_ratio  = today_vol / avg_vol if avg_vol > 0 else 1.0

        # ── 52-week levels ────────────────────────────────────────────────────
        hi52 = float(high.tail(252).max()) if len(high) >= 252 else float(high.max())
        lo52 = float(low.tail(252).min())  if len(low)  >= 252 else float(low.min())

        # ── IV proxy ──────────────────────────────────────────────────────────
        iv_pct = min(100.0, float(close.pct_change().rolling(30).std().iloc[-1] * np.sqrt(252) * 100) * 1.5)

        # ── Side-data (run concurrently in sub-threads) ───────────────────────
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
            f_news    = ex.submit(_news_headlines, ticker)
            f_social  = ex.submit(_stocktwits, ticker)
            f_options = ex.submit(_options_flow, ticker)
            headlines = f_news.result()
            social    = f_social.result()
            opts      = f_options.result()

        ns = _news_score(headlines)      # -1 to 1
        ns100 = (ns + 1) / 2 * 100      # 0-100
        ss100 = social["score"] * 100    # 0-100

        # ── Score dimensions (0-100) ──────────────────────────────────────────
        # Technical
        tech = 50.0
        if   rsi < 30:  tech += 25
        elif rsi < 40:  tech += 12
        elif rsi > 70:  tech -= 25
        elif rsi > 60:  tech -= 8
        if macd_bull:   tech += 10
        if macd_cross:  tech += 8
        if cur > vwap:  tech += 10
        if cur > sma20: tech += 8
        if cur > sma50: tech += 5
        if bb_pos < 0.2: tech += 6   # near lower band → reversal zone
        elif bb_pos > 0.8: tech -= 6
        tech = max(0.0, min(100.0, tech))

        # Momentum
        mom = 50.0
        if   day_chg > 4:  mom += 28
        elif day_chg > 2:  mom += 16
        elif day_chg > 0.5: mom += 7
        elif day_chg < -4: mom -= 28
        elif day_chg < -2: mom -= 16
        elif day_chg < -0.5: mom -= 7
        if   week_chg > 8:  mom += 14
        elif week_chg > 3:  mom += 7
        elif week_chg < -8: mom -= 14
        elif week_chg < -3: mom -= 7
        if   vol_ratio > 3: mom += 14
        elif vol_ratio > 2: mom += 8
        elif vol_ratio > 1.5: mom += 4
        elif vol_ratio < 0.5: mom -= 8
        mom = max(0.0, min(100.0, mom))

        # Sentiment
        sent = ns100 * 0.45 + ss100 * 0.55

        # Whale / Options
        pcr   = opts["put_call_ratio"]
        whale = 50.0
        if   pcr < 0.35: whale += 30
        elif pcr < 0.55: whale += 18
        elif pcr < 0.75: whale += 8
        elif pcr > 2.5:  whale -= 30
        elif pcr > 1.8:  whale -= 18
        elif pcr > 1.2:  whale -= 8
        if vol_ratio > 2 and cur > vwap: whale += 8   # smart-money confirmation
        whale = max(0.0, min(100.0, whale))

        # Target (ATR-based R:R proxy)
        target_px = round(cur + atr * 2.5, 2)
        stop_px   = round(cur - atr * 1.0, 2)
        risk_r    = abs(cur - stop_px)
        rew_r     = abs(target_px - cur)
        rr        = round(rew_r / risk_r, 2) if risk_r > 0 else 0.0
        tgt_score = min(100.0, max(0.0, 40.0 + rr * 15))

        # ── Composite ─────────────────────────────────────────────────────────
        composite = (
            tech  * 0.28 +
            mom   * 0.25 +
            sent  * 0.20 +
            whale * 0.17 +
            tgt_score * 0.10
        )

        # ── Decision ──────────────────────────────────────────────────────────
        if composite >= 68 and mom >= 58:
            trade_type, decision = "DAY_TRADE", "BUY"
        elif composite >= 62:
            trade_type, decision = "WEEKLY_TRADE", "BUY"
        elif composite <= 34 and mom <= 38:
            trade_type, decision = "DAY_TRADE", "SHORT"
            target_px = round(cur - atr * 2.5, 2)
            stop_px   = round(cur + atr * 1.0, 2)
        elif composite <= 40:
            trade_type, decision = "WEEKLY_TRADE", "AVOID"
        else:
            trade_type, decision = "WATCH", "HOLD"

        # ── Key reasons ───────────────────────────────────────────────────────
        reasons: list[str] = []
        if rsi < 35:       reasons.append(f"RSI {rsi:.0f} — oversold, high reversal probability")
        elif rsi > 65:     reasons.append(f"RSI {rsi:.0f} — overbought, momentum stretched")
        else:              reasons.append(f"RSI {rsi:.0f} — healthy neutral-bullish zone")
        if macd_cross:     reasons.append("MACD bullish crossover — momentum flipping positive")
        elif macd_bull:    reasons.append("MACD above signal — positive momentum sustained")
        else:              reasons.append("MACD below signal — bearish momentum active")
        if cur > vwap:     reasons.append(f"Price ${cur:.2f} above VWAP ${vwap:.2f} — institutional buy bias")
        else:              reasons.append(f"Price ${cur:.2f} below VWAP ${vwap:.2f} — institutional sell bias")
        if vol_ratio > 2:  reasons.append(f"Volume {vol_ratio:.1f}× average — unusual institutional activity")
        elif vol_ratio > 1.3: reasons.append(f"Volume {vol_ratio:.1f}× average — elevated retail interest")
        if social["total"] > 0:
            bpct = int(social["score"] * 100)
            reasons.append(f"StockTwits {bpct}% bullish ({social['bullish']} bulls / {social['bearish']} bears)")
        if opts["unusual"]:
            if pcr < 0.5:  reasons.append(f"Unusual call sweep — P/C {pcr:.2f}, smart money positioned long")
            else:          reasons.append(f"Unusual put buying — P/C {pcr:.2f}, smart money hedging downside")
        if ns > 0.2:       reasons.append(f"Positive news flow (score {ns:+.2f}) — bullish headlines dominate")
        elif ns < -0.2:    reasons.append(f"Negative news flow (score {ns:+.2f}) — bearish headlines dominate")
        if day_chg > 2:    reasons.append(f"Strong intraday momentum +{day_chg:.1f}%")
        elif day_chg < -2: reasons.append(f"Intraday weakness {day_chg:.1f}% — selling pressure")
        if cur > sma20 and cur > sma50: reasons.append("Price above both SMA20 & SMA50 — confirmed uptrend")
        elif cur < sma20 and cur < sma50: reasons.append("Price below both SMA20 & SMA50 — confirmed downtrend")

        return {
            "ticker":      ticker,
            "company":     COMPANY_NAMES.get(ticker, ticker),
            "price":       round(cur, 2),
            "change_pct":  round(day_chg, 2),
            "week_chg":    round(week_chg, 2),
            "month_chg":   round(month_chg, 2),
            "composite":   round(composite, 1),
            "trade_type":  trade_type,
            "decision":    decision,
            "scores": {
                "technical": round(tech, 1),
                "momentum":  round(mom, 1),
                "sentiment": round(sent, 1),
                "whale":     round(whale, 1),
                "target":    round(tgt_score, 1),
            },
            "technicals": {
                "rsi":        round(rsi, 1),
                "macd_bull":  macd_bull,
                "macd_cross": macd_cross,
                "vwap":       round(vwap, 2),
                "sma20":      round(sma20, 2),
                "sma50":      round(sma50, 2),
                "above_vwap": cur > vwap,
                "above_sma20": cur > sma20,
                "above_sma50": cur > sma50,
                "bb_position": round(bb_pos, 2),
                "atr":         round(atr, 2),
                "atr_pct":     round(atr / cur * 100, 2),
                "iv_pct":      round(iv_pct, 1),
                "hi52":        round(hi52, 2),
                "lo52":        round(lo52, 2),
            },
            "momentum": {
                "day_chg":   round(day_chg, 2),
                "week_chg":  round(week_chg, 2),
                "month_chg": round(month_chg, 2),
                "vol_ratio": round(vol_ratio, 2),
                "vol_today": int(today_vol),
                "vol_avg":   int(avg_vol),
            },
            "sentiment": {
                "news_score":       round(ns, 2),
                "social_bull_pct":  int(social["score"] * 100),
                "social_bullish":   social["bullish"],
                "social_bearish":   social["bearish"],
                "social_total":     social["total"],
                "headlines":        headlines[:3],
            },
            "whale": {
                "put_call_ratio": pcr,
                "call_vol":       opts["call_vol"],
                "put_vol":        opts["put_vol"],
                "unusual":        opts["unusual"],
                "vol_ratio":      round(vol_ratio, 2),
            },
            "trade": {
                "entry":      round(cur, 2),
                "target":     round(target_px, 2),
                "stop_loss":  round(stop_px, 2),
                "rr_ratio":   rr,
                "atr":        round(atr, 2),
            },
            "reasons": reasons[:6],
        }
    except Exception:
        return None


# ── Public scan entry point ───────────────────────────────────────────────────

def run_scan() -> dict:
    global _scan_cache, _scan_cache_time
    now = time.time()
    if _scan_cache and (now - _scan_cache_time) < CACHE_TTL:
        return {**_scan_cache, "cached": True}

    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(_analyze, t): t for t in WATCHLIST}
        for fut in concurrent.futures.as_completed(futures):
            r = fut.result()
            if r:
                results.append(r)

    results.sort(key=lambda x: x["composite"], reverse=True)

    day_trades    = [r for r in results if r["trade_type"] == "DAY_TRADE"    and r["decision"] in ("BUY", "SHORT")]
    weekly_trades = [r for r in results if r["trade_type"] == "WEEKLY_TRADE" and r["decision"] == "BUY"]

    # Pad to 5 each if scanner conditions are strict
    if len(day_trades) < 5:
        extras = [r for r in results if r not in day_trades]
        day_trades.extend(extras[:5 - len(day_trades)])
    if len(weekly_trades) < 5:
        extras = [r for r in results if r not in weekly_trades and r not in day_trades]
        weekly_trades.extend(extras[:5 - len(weekly_trades)])

    from datetime import datetime
    output = {
        "scanned":       len(results),
        "scan_time":     datetime.now().isoformat(),
        "cached":        False,
        "top_overall":   results[:10],
        "day_trades":    day_trades[:5],
        "weekly_trades": weekly_trades[:5],
    }
    _scan_cache      = output
    _scan_cache_time = now
    return output
