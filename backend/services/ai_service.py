from models.schemas import (
    AIEnginePayload, AISuggestion, Decision, StrategyType,
    TechnicalData, SentimentData, WhaleFlow
)


BEARISH_KEYWORDS = {"crash", "recession", "fraud", "downgrade", "miss", "loss", "fear", "warning"}
BULLISH_KEYWORDS = {"beat", "upgrade", "growth", "profit", "surge", "breakout", "strong", "record"}


def _score_headlines(headlines: list[str]) -> float:
    score = 0.0
    for h in headlines:
        lower = h.lower()
        score += sum(1 for w in BULLISH_KEYWORDS if w in lower)
        score -= sum(1 for w in BEARISH_KEYWORDS if w in lower)
    return max(-1.0, min(1.0, score / max(len(headlines), 1)))


def run_ai_engine(payload: AIEnginePayload) -> AISuggestion:
    tech = payload.technical
    sentiment = payload.sentiment or SentimentData()
    whale = payload.whale_flow or WhaleFlow()
    ticker = payload.ticker
    reasoning: list[str] = []
    signals: list[float] = []

    # Rule: no trade during high-impact economic events
    if payload.high_impact_event:
        return AISuggestion(
            ticker=ticker, decision=Decision.AVOID,
            strategy=StrategyType.MOMENTUM,
            target=tech.current_price, stop_loss=tech.current_price,
            confidence_level=95.0,
            reasoning=["High-impact economic event active — standing aside per risk rules."],
            risk_reward_ratio=0.0,
        )

    # Rule: high IV percentile → prefer credit spreads
    if tech.iv_percentile > 80:
        reasoning.append(f"IV Percentile {tech.iv_percentile:.0f}% > 80 — credit spreads favored over buying naked options.")
        return AISuggestion(
            ticker=ticker, decision=Decision.CREDIT_SPREAD,
            strategy=StrategyType.OPTIONS,
            target=round(tech.current_price * 1.03, 2),
            stop_loss=round(tech.current_price * 0.97, 2),
            confidence_level=70.0,
            reasoning=reasoning,
            risk_reward_ratio=1.5,
        )

    # RSI signal
    if tech.rsi < 35:
        signals.append(1.0)
        reasoning.append(f"RSI {tech.rsi:.1f} — oversold territory, potential reversal up.")
    elif tech.rsi > 65:
        signals.append(-0.5)
        reasoning.append(f"RSI {tech.rsi:.1f} — overbought territory, caution on longs.")
    else:
        signals.append(0.2)
        reasoning.append(f"RSI {tech.rsi:.1f} — neutral zone.")

    # MACD signal
    macd_cross = tech.macd - tech.macd_signal
    if macd_cross > 0:
        signals.append(0.8)
        reasoning.append("MACD bullish crossover — momentum turning positive.")
    else:
        signals.append(-0.8)
        reasoning.append("MACD bearish crossover — momentum turning negative.")

    # VWAP signal
    if tech.current_price > tech.vwap:
        signals.append(0.6)
        reasoning.append(f"Price ${tech.current_price} above VWAP ${tech.vwap:.2f} — institutional bias bullish.")
    else:
        signals.append(-0.6)
        reasoning.append(f"Price ${tech.current_price} below VWAP ${tech.vwap:.2f} — institutional bias bearish.")

    # Sentiment signal
    headline_score = _score_headlines(sentiment.headlines)
    combined_sentiment = (headline_score + sentiment.social_score) / 2
    if combined_sentiment > 0.2:
        signals.append(0.5)
        reasoning.append(f"Sentiment positive ({combined_sentiment:.2f}) — news/social tailwind.")
    elif combined_sentiment < -0.2:
        signals.append(-0.5)
        reasoning.append(f"Sentiment negative ({combined_sentiment:.2f}) — news/social headwind.")

    # Whale flow signal
    if whale.direction == "bullish":
        if tech.rsi > 70:
            signals.append(-0.3)
            reasoning.append("Whale flow bullish but RSI > 70 — potential overbought trap, reducing conviction.")
        else:
            signals.append(1.0)
            reasoning.append(f"Bullish whale flow detected (volume ratio {whale.volume_ratio:.1f}x) — institutional accumulation.")
    elif whale.direction == "bearish":
        signals.append(-1.0)
        reasoning.append(f"Bearish whale flow detected — smart money distributing.")

    # Aggregate signal
    avg_signal = sum(signals) / len(signals) if signals else 0.0
    confidence = min(95.0, abs(avg_signal) * 80 + 20)

    if avg_signal > 0.4:
        decision = Decision.BUY
        target = round(tech.current_price * 1.04, 2)
        stop_loss = round(tech.current_price * 0.98, 2)
        strategy = StrategyType.MOMENTUM if avg_signal > 0.6 else StrategyType.BREAKOUT
    elif avg_signal < -0.4:
        decision = Decision.SELL
        target = round(tech.current_price * 0.96, 2)
        stop_loss = round(tech.current_price * 1.02, 2)
        strategy = StrategyType.MEAN_REVERSION
    else:
        decision = Decision.HOLD
        target = tech.current_price
        stop_loss = round(tech.current_price * 0.98, 2)
        strategy = StrategyType.MOMENTUM

    reward = abs(tech.current_price - target)
    risk = abs(tech.current_price - stop_loss)
    rr_ratio = round(reward / risk, 2) if risk > 0 else 0.0

    return AISuggestion(
        ticker=ticker,
        decision=decision,
        strategy=strategy,
        target=target,
        stop_loss=stop_loss,
        confidence_level=round(confidence, 1),
        reasoning=reasoning,
        risk_reward_ratio=rr_ratio,
    )
