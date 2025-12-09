from fastapi import APIRouter, Query, HTTPException
import logging
from typing import Optional
from config import TECHNICAL_CACHE_TTL_SECONDS
from data.tools import get_raw_ta_indicators

router = APIRouter()
logger = logging.getLogger("crypto-sentinel")


@router.get("/data")
def get_technical_data(
    symbol: Optional[str] = Query("BTC"),
    days: Optional[int] = Query(180),
    force: Optional[bool] = Query(False)
):
    """
    Return OHLCV and computed technical indicators for the requested symbol.

    This endpoint is designed for FRONTEND consumption (UI charts).
    
    Flow:
    1. Check cache (unless force=true)
    2. Fetch raw OHLCV from CoinGecko
    3. Compute TA indicators (EMA, MACD, RSI, Bollinger Bands)
    4. Cache result for TECHNICAL_CACHE_TTL_SECONDS
    5. Return data for UI charts

    Agents should NOT call this endpoint.
    Agents use get_raw_ta_indicators() or get_raw_ohlcv() tool functions directly.
    """
    sym = (symbol or "BTC").upper()
    
    try:
        result = get_raw_ta_indicators(
            symbol=sym,
            days=days,
            force_refresh=force
        )
        
        if result.get("error"):
            logger.error("TA indicators error for %s: %s", sym, result.get("error"))
            raise HTTPException(status_code=502, detail="something went wrong")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in get_technical_data: %s", e)
        raise HTTPException(status_code=502, detail="something went wrong")
