from fastapi import APIRouter, Query
from services.news_service import fetch_news

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/")
def get_news(ticker: str = Query("", description="Optional ticker symbol"), limit: int = Query(20)):
    items = fetch_news(ticker, limit)
    return {"items": items}
