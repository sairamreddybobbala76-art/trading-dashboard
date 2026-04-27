from fastapi import APIRouter
from services.scanner_service import run_scan

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.get("/scan")
def scan():
    """Run the AI stock scanner across 30 high-liquidity tickers.
    Results cached for 2 minutes."""
    return run_scan()


@router.delete("/cache")
def clear_cache():
    """Force-expire the scan cache so the next /scan runs fresh."""
    from services import scanner_service
    scanner_service._scan_cache = None
    scanner_service._scan_cache_time = 0.0
    return {"cleared": True}
