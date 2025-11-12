from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from data.fetch_market import fetch_ohlcv_data, get_supported_coins
from analysis import indicators as ind
from utils import cache as cache_utils
import pandas as pd

router = APIRouter()


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
def get_technical_data(symbol: Optional[str] = Query("BTC"), days: Optional[int] = Query(90)):
    """Return OHLCV and a set of computed technical indicators for the requested symbol.

    Behavior:
    - Check in-memory cache for symbol (e.g. "BTC"). If present and contains a ready payload, return it.
    - Otherwise fetch from CoinGecko via `fetch_ohlcv_data`, compute indicators, cache result and return it.
    """
    sym = (symbol or "BTC").upper()
    key = f"TECH::{sym}::days={days}"

    # check cache
    cached = cache_utils.get(key)
    if cached:
        return cached

    # Determine CoinGecko id
    coins = get_supported_coins()
    coin_id = coins.get(sym, sym.lower())

    # Fetch OHLCV
    result = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=days, interval="daily")
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=502, detail=result.get("error"))

    df: pd.DataFrame = result
    if df.empty:
        raise HTTPException(status_code=404, detail="No market data returned")

    # compute indicators
    indicators = ind.compute_all_indicators(df)

    payload = {
        "symbol": sym,
        "coin_id": coin_id,
        "ohlcv": _df_to_json_like(df),
        "indicators": indicators,
    }

    # cache for 10 minutes (600s)
    cache_utils.set(key, payload, ttl=600)

    return payload
