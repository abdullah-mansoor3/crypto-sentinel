from fastapi import APIRouter, Query, HTTPException
import logging
from typing import Optional
from data.fetch_market import fetch_ohlcv_data, get_supported_coins
from analysis.quant_metrics import compute_all_quant_metrics
from utils import cache as cache_utils
from config import TECHNICAL_CACHE_TTL_SECONDS
import pandas as pd

router = APIRouter()
logger = logging.getLogger("crypto-sentinel")


@router.get("/quant")
def get_quant_metrics(
    symbol: Optional[str] = Query("BTC"),
    days: Optional[int] = Query(180),
    force: Optional[bool] = Query(False)
):
    """
    Return comprehensive quantitative finance metrics for the requested symbol.
    
    Metrics include:
    - Volatility: Rolling std (7d, 14d, 30d), ATR with trend
    - Trend: ADX with strength classification
    - Market Structure: Regime classification, OBV analysis
    - Risk/Liquidity: Sharpe ratio, liquidity estimate, VATR
    
    Also returns formulas for frontend tooltip display.
    
    This endpoint is for FRONTEND consumption.
    Agents use get_raw_quant_metrics() tool function directly.
    """
    sym = (symbol or "BTC").upper()
    cache_key = f"QUANT::{sym}::days={days}"
    
    # Check cache unless forced
    if not force:
        cached = cache_utils.get(cache_key)
        if cached:
            logger.debug("Using cached quant metrics for %s", sym)
            return cached
    
    try:
        # Get coin ID
        coins = get_supported_coins()
        coin_id = coins.get(sym, sym.lower())
        
        # Fetch OHLCV data
        result = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=days, interval="daily")
        
        if isinstance(result, dict) and result.get("error"):
            logger.error("Market fetch error for %s: %s", coin_id, result.get("error"))
            raise HTTPException(status_code=502, detail="Failed to fetch market data")
        
        df: pd.DataFrame = result
        if df.empty:
            raise HTTPException(status_code=502, detail="No market data available")
        
        # Compute all quant metrics
        metrics = compute_all_quant_metrics(df)
        
        payload = {
            "symbol": sym,
            "coin_id": coin_id,
            "days": days,
            **metrics
        }
        
        # Cache result
        try:
            cache_utils.set(cache_key, payload, ttl=TECHNICAL_CACHE_TTL_SECONDS)
        except Exception as e:
            logger.warning("Failed to cache quant metrics: %s", e)
        
        return payload
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in get_quant_metrics: %s", e)
        raise HTTPException(status_code=500, detail="something went wrong")