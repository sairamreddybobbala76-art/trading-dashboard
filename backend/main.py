import asyncio
import os
import time
from contextlib import asynccontextmanager

import yfinance as yf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from routers import market_data, ai_engine, news, risk_manager, scanner, market_overview


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Day Trading Dashboard API", lifespan=lifespan)

# FRONTEND_URL env var is set in Render dashboard after you know the Vercel URL.
# Falls back to localhost for local dev.
_frontend_url = os.getenv("FRONTEND_URL", "")
ALLOWED_ORIGINS = list(filter(None, [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    _frontend_url,
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",   # covers all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market_data.router)
app.include_router(ai_engine.router)
app.include_router(news.router)
app.include_router(risk_manager.router)
app.include_router(scanner.router)
app.include_router(market_overview.router)


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, ticker: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(ticker, []).append(ws)

    def disconnect(self, ticker: str, ws: WebSocket):
        if ticker in self.active:
            self.active[ticker].remove(ws)

    async def broadcast(self, ticker: str, data: dict):
        dead = []
        for ws in self.active.get(ticker, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active[ticker].remove(ws)


manager = ConnectionManager()


@app.websocket("/ws/price/{ticker}")
async def price_feed(websocket: WebSocket, ticker: str):
    ticker = ticker.upper()
    await manager.connect(ticker, websocket)
    stock = yf.Ticker(ticker)
    try:
        while True:
            try:
                info = stock.fast_info
                price = round(float(info.last_price), 2)
                bar = {
                    "type": "tick",
                    "ticker": ticker,
                    "price": price,
                    "time": int(time.time()),
                }
                await websocket.send_json(bar)
            except Exception:
                pass
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        manager.disconnect(ticker, websocket)


@app.get("/")
def root():
    return {"status": "Day Trading Dashboard API running"}
