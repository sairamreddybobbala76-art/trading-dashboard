import feedparser
import time
from typing import List
from models.schemas import NewsItem

BEARISH_WORDS = {"crash", "recession", "fraud", "downgrade", "miss", "loss", "fear", "warning", "risk", "fall", "drop"}
BULLISH_WORDS = {"beat", "upgrade", "growth", "profit", "surge", "breakout", "strong", "record", "rally", "rise", "gain"}

RSS_FEEDS = {
    "Reuters": "https://feeds.reuters.com/reuters/businessNews",
    "MarketWatch": "https://feeds.content.dowjones.io/public/rss/mw_marketpulse",
    "Seeking Alpha": "https://seekingalpha.com/market_currents.xml",
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
}


def _simple_sentiment(text: str) -> float:
    lower = text.lower()
    score = 0
    score += sum(1 for w in BULLISH_WORDS if w in lower)
    score -= sum(1 for w in BEARISH_WORDS if w in lower)
    return max(-1.0, min(1.0, score / 3.0))


def fetch_news(ticker: str = "", limit: int = 20) -> List[dict]:
    items: List[dict] = []

    # Yahoo Finance ticker-specific feed
    if ticker:
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:limit]:
                published = entry.get("published", "")
                title = entry.get("title", "")
                items.append({
                    "title": title,
                    "source": "Yahoo Finance",
                    "url": entry.get("link", ""),
                    "published": published,
                    "sentiment": _simple_sentiment(title),
                })
        except Exception:
            pass

    # General market feeds
    for source, feed_url in RSS_FEEDS.items():
        if len(items) >= limit:
            break
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:5]:
                title = entry.get("title", "")
                items.append({
                    "title": title,
                    "source": source,
                    "url": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "sentiment": _simple_sentiment(title),
                })
        except Exception:
            continue

    return items[:limit]
