from fastapi import APIRouter, Query, HTTPException
import logging
from typing import Optional
from data.fetch_market import fetch_ohlcv_data, get_supported_coins
from analysis import indicators as ind
from utils import cache as cache_utils
import pandas as pd

router = APIRouter()
logger = logging.getLogger("crypto-sentinel")


def _df_to_json_like(df: pd.DataFrame) -> dict:
    """Convert OHLCV DataFrame to JSON-serializable dict of lists."""
    # ensure timestamp is a list of ISO strings
    if hasattr(df["timestamp"], "dt"):
        timestamps = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S").tolist()
    else:
        timestamps = df["timestamp"].astype(str).tolist()

    return {
        "timestamp": timestamps,
        "open": df["open"].tolist(),
        "high": df["high"].tolist(),
        "low": df["low"].tolist(),
        "close": df["close"].tolist(),
        "volume": df["volume"].tolist() if "volume" in df.columns else [None] * len(df),
    }


@router.get("/data")
def get_technical_data(symbol: Optional[str] = Query("BTC"), days: Optional[int] = Query(180), force: Optional[bool] = Query(False)):
    """Return OHLCV and a set of computed technical indicators for the requested symbol.

    Behavior:
    - Check in-memory cache for symbol (e.g. "BTC"). If present and contains a ready payload, return it.
    - Otherwise fetch from CoinGecko via `fetch_ohlcv_data`, compute indicators, cache result and return it.
    """
    sym = (symbol or "BTC").upper()
    key = f"TECH::{sym}::days={days}"

    # check cache (unless forced)
    if not force:
        cached = cache_utils.get(key)
        if cached:
            return cached

    try:
        # Determine CoinGecko id
        coins = get_supported_coins()
        coin_id = coins.get(sym, sym.lower())

        # Fetch OHLCV always using hourly data for the requested days (default 180 days)
        result = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=days, interval="hourly")
        if isinstance(result, dict) and result.get("error"):
            logger.exception("Market fetch error for %s: %s", coin_id, result.get("error"))
            raise HTTPException(status_code=502, detail="something went wrong")

        df: pd.DataFrame = result
        if df.empty:
            # attempt fallbacks: try shorter hourly window, then daily
            try:
                fallback = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=90, interval="hourly")
                if isinstance(fallback, dict) and fallback.get("error"):
                    # try daily
                    fallback2 = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=days, interval="daily")
                    if isinstance(fallback2, dict) and fallback2.get("error"):
                        raise HTTPException(status_code=502, detail=f"Market fetch failed: {fallback2.get('error')}")
                    else:
                        df = fallback2
                else:
                    df = fallback
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=502, detail=str(e))

        if df.empty:
            logger.error("Market data fetch returned no usable OHLCV for %s after fallbacks", coin_id)
            raise HTTPException(status_code=502, detail="something went wrong")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in get_technical_data: %s", e)
        raise HTTPException(status_code=502, detail="something went wrong")
    # compute indicators on the hourly dataframe (no resampling)
    indicators = ind.compute_all_indicators(df)

    payload = {
        "symbol": sym,
        "coin_id": coin_id,
        "ohlcv": _df_to_json_like(df),
        "indicators": indicators,
    }

    # cache for 10 minutes (600s)
    try:
        cache_utils.set(key, payload, ttl=600)
    except Exception:
        logger.exception("Failed to persist cache for %s", key)

    return payload
