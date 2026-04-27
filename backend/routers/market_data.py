from fastapi import APIRouter, Query
from services.market_service import get_candlestick_data, get_current_price, compute_technicals

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/candles/{ticker}")
def candles(
    ticker: str,
    period: str = Query("5d", description="yfinance period: 1d,5d,1mo"),
    interval: str = Query("5m", description="yfinance interval: 1m,5m,15m,1h,1d"),
):
    data = get_candlestick_data(ticker.upper(), period, interval)
    return {"ticker": ticker.upper(), "bars": data}


@router.get("/price/{ticker}")
def price(ticker: str):
    p = get_current_price(ticker.upper())
    return {"ticker": ticker.upper(), "price": p}


@router.get("/technicals/{ticker}")
def technicals(ticker: str):
    data = compute_technicals(ticker.upper())
    return {"ticker": ticker.upper(), "technicals": data.model_dump()}
