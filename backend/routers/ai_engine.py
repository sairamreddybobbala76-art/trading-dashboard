from fastapi import APIRouter
from models.schemas import AIEnginePayload, AISuggestion
from services.ai_service import run_ai_engine
from services.market_service import compute_technicals
from services.news_service import fetch_news
from models.schemas import SentimentData

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/suggest", response_model=AISuggestion)
def suggest(payload: AIEnginePayload):
    return run_ai_engine(payload)


@router.get("/auto-suggest/{ticker}", response_model=AISuggestion)
def auto_suggest(ticker: str, high_impact_event: bool = False):
    """Fetch live technicals + news, then run the AI engine automatically."""
    tech = compute_technicals(ticker.upper())
    news_items = fetch_news(ticker.upper(), limit=10)
    headlines = [n["title"] for n in news_items]
    social_score = sum(n["sentiment"] for n in news_items) / max(len(news_items), 1)

    payload = AIEnginePayload(
        ticker=ticker.upper(),
        technical=tech,
        sentiment=SentimentData(headlines=headlines, social_score=social_score),
        high_impact_event=high_impact_event,
    )
    return run_ai_engine(payload)
