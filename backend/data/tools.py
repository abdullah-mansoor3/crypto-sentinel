"""
Centralized tool functions for agents and routes.

These functions are designed to be called by:
1. API routes (for frontend consumption)
2. AI agents (for agentic workflows)

Each function returns raw data in a consistent, JSON-serializable format.
Agents should use these functions directly, NOT the HTTP endpoints.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
import logging
import pandas as pd

from config import (
    MARKET_CACHE_TTL_SECONDS,
    TECHNICAL_CACHE_TTL_SECONDS,
    NEWS_STALE_HOURS,
)
from utils import cache as cache_utils

logger = logging.getLogger("crypto-sentinel.tools")


# -----------------------------------------------------------------------------
# News Tools
# -----------------------------------------------------------------------------

def get_raw_news(limit: int = 20, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Fetch raw news articles with per-headline sentiment.
    
    Returns a list of dicts:
    [
        {
            "id": str,
            "title": str,
            "url": str,
            "published_at": str (ISO format),
            "content": str,
            "source": str | None,
            "sentiment": str ("positive" | "negative" | "neutral"),
            "sentiment_score": float (-1.0 to 1.0)
        },
        ...
    ]
    
    Flow:
    1. Check disk cache (if fresh within NEWS_STALE_HOURS)
    2. Fetch from Cryptopanic API
    3. Compute sentiment per headline
    4. Store in vector DB (if embeddings enabled)
    5. Persist to disk cache
    """
    from data.fetch_news import (
        _read_news_cache,
        _write_news_cache,
        fetch_latest_from_cryptopanic,
        upsert_articles_to_vector_db,
        compute_sentiment,
    )
    
    stale_delta = timedelta(hours=NEWS_STALE_HOURS)
    now = datetime.now(timezone.utc)
    
    # Check disk cache first (unless force refresh)
    if not force_refresh:
        cached = _read_news_cache()
        if cached:
            try:
                articles = cached.get("articles") or []
                last_fetched = cached.get("last_fetched")
                if last_fetched and articles:
                    last_dt = datetime.fromisoformat(last_fetched)
                    if now - last_dt < stale_delta:
                        logger.debug("Using cached news (%d articles)", len(articles))
                        # Ensure sentiment is computed for each article
                        return _ensure_sentiment(articles[:limit])
            except Exception as e:
                logger.warning("Failed to read news cache: %s", e)
    
    # Fetch fresh from API
    logger.debug("Fetching fresh news from Cryptopanic API")
    raw_articles = fetch_latest_from_cryptopanic(limit=limit)
    
    if not raw_articles:
        # Fallback to cache if API returns nothing
        cached = _read_news_cache()
        if cached and cached.get("articles"):
            return _ensure_sentiment(cached["articles"][:limit])
        return []
    
    # Compute sentiment for each article
    enriched = _ensure_sentiment(raw_articles)
    
    # Persist to disk cache
    try:
        _write_news_cache(enriched)
    except Exception as e:
        logger.warning("Failed to write news cache: %s", e)
    
    # Upsert to vector DB (for semantic search later)
    try:
        upsert_articles_to_vector_db(enriched)
    except Exception as e:
        logger.warning("Failed to upsert to vector DB: %s", e)
    
    return enriched[:limit]


def _ensure_sentiment(articles: List[Dict]) -> List[Dict]:
    """Ensure each article has sentiment and sentiment_score fields."""
    from data.fetch_news import compute_sentiment
    
    result = []
    for article in articles:
        a = dict(article)  # copy to avoid mutating original
        if "sentiment" not in a or "sentiment_score" not in a:
            text = (a.get("title") or "") + " " + (a.get("content") or "")
            sentiment, score = compute_sentiment(text)
            a["sentiment"] = sentiment
            a["sentiment_score"] = score
        result.append(a)
    return result


# -----------------------------------------------------------------------------
# Market / Price Tools
# -----------------------------------------------------------------------------

def get_raw_prices(symbol: str = "BTC", vs_currency: str = "usd", days: int = 30) -> Dict[str, Any]:
    """
    Get raw price data (close prices only) for a symbol.
    
    Returns:
    {
        "symbol": str,
        "vs_currency": str,
        "prices": [
            {"timestamp": str (ISO), "price": float},
            ...
        ]
    }
    """
    from data.fetch_market import fetch_ohlcv_data, get_supported_coins
    
    coins = get_supported_coins()
    coin_id = coins.get(symbol.upper(), symbol.lower())
    
    result = fetch_ohlcv_data(coin_id=coin_id, vs_currency=vs_currency, days=days, interval="daily")
    
    if isinstance(result, dict) and result.get("error"):
        return {"symbol": symbol, "vs_currency": vs_currency, "prices": [], "error": result["error"]}
    
    df: pd.DataFrame = result
    if df.empty:
        return {"symbol": symbol, "vs_currency": vs_currency, "prices": []}
    
    prices = []
    for _, row in df.iterrows():
        ts = row["timestamp"]
        if hasattr(ts, "isoformat"):
            ts_str = ts.isoformat()
        else:
            ts_str = str(ts)
        prices.append({
            "timestamp": ts_str,
            "price": float(row["close"]) if pd.notna(row["close"]) else None
        })
    
    return {"symbol": symbol, "vs_currency": vs_currency, "prices": prices}


def get_raw_ohlcv(symbol: str = "BTC", vs_currency: str = "usd", days: int = 180, interval: str = "hourly") -> Dict[str, Any]:
    """
    Get raw OHLCV data for a symbol.
    
    Returns:
    {
        "symbol": str,
        "coin_id": str,
        "interval": str,
        "ohlcv": {
            "timestamp": [str, ...],
            "open": [float, ...],
            "high": [float, ...],
            "low": [float, ...],
            "close": [float, ...],
            "volume": [float | None, ...]
        }
    }
    """
    from data.fetch_market import fetch_ohlcv_data, get_supported_coins
    
    coins = get_supported_coins()
    coin_id = coins.get(symbol.upper(), symbol.lower())
    
    result = fetch_ohlcv_data(coin_id=coin_id, vs_currency=vs_currency, days=days, interval=interval)
    
    if isinstance(result, dict) and result.get("error"):
        return {
            "symbol": symbol,
            "coin_id": coin_id,
            "interval": interval,
            "ohlcv": None,
            "error": result["error"]
        }
    
    df: pd.DataFrame = result
    if df.empty:
        return {
            "symbol": symbol,
            "coin_id": coin_id,
            "interval": interval,
            "ohlcv": {"timestamp": [], "open": [], "high": [], "low": [], "close": [], "volume": []}
        }
    
    ohlcv = _df_to_ohlcv_dict(df)
    
    return {
        "symbol": symbol,
        "coin_id": coin_id,
        "interval": interval,
        "ohlcv": ohlcv
    }


def _df_to_ohlcv_dict(df: pd.DataFrame) -> Dict[str, List]:
    """Convert OHLCV DataFrame to JSON-serializable dict of lists."""
    if hasattr(df["timestamp"], "dt"):
        timestamps = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S").tolist()
    else:
        timestamps = df["timestamp"].astype(str).tolist()

    def safe_list(series):
        return [None if pd.isna(x) else float(x) for x in series.tolist()]

    return {
        "timestamp": timestamps,
        "open": safe_list(df["open"]),
        "high": safe_list(df["high"]),
        "low": safe_list(df["low"]),
        "close": safe_list(df["close"]),
        "volume": safe_list(df["volume"]) if "volume" in df.columns else [None] * len(df),
    }


# -----------------------------------------------------------------------------
# Technical Analysis Tools
# -----------------------------------------------------------------------------

def get_raw_ta_indicators(
    symbol: str = "BTC",
    days: int = 180,
    ema_periods: List[int] = None,
    rsi_period: int = 14,
    macd_params: Dict = None,
    bb_window: int = 20,
    bb_std: int = 2,
    force_refresh: bool = False
) -> Dict[str, Any]:
    """
    Compute technical indicators for a symbol.
    
    Returns:
    {
        "symbol": str,
        "coin_id": str,
        "ohlcv": {...},  # raw OHLCV data
        "indicators": {
            "ema": {"10": [...], "20": [...], "50": [...]},
            "macd": {"macd": [...], "signal": [...], "hist": [...]},
            "rsi": [...],
            "bbands": {"mid": [...], "upper": [...], "lower": [...]}
        }
    }
    """
    from data.fetch_market import fetch_ohlcv_data, get_supported_coins
    from analysis import indicators as ind
    
    if ema_periods is None:
        ema_periods = [20, 50, 100, 200]
    if macd_params is None:
        macd_params = {"fast": 12, "slow": 26, "signal": 9}
    
    sym = symbol.upper()
    cache_key = f"TECH::{sym}::days={days}"
    
    # Check cache unless forced
    if not force_refresh:
        cached = cache_utils.get(cache_key)
        if cached:
            logger.debug("Using cached TA indicators for %s", sym)
            return cached
    
    coins = get_supported_coins()
    coin_id = coins.get(sym, sym.lower())
    
    # Fetch OHLCV
    result = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=days, interval="hourly")
    
    if isinstance(result, dict) and result.get("error"):
        return {"symbol": sym, "coin_id": coin_id, "error": result["error"]}
    
    df: pd.DataFrame = result
    if df.empty:
        # Try fallbacks
        for fallback_days, fallback_interval in [(90, "hourly"), (days, "daily")]:
            fallback = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=fallback_days, interval=fallback_interval)
            if not isinstance(fallback, dict) or not fallback.get("error"):
                df = fallback
                break
    
    if df.empty:
        return {"symbol": sym, "coin_id": coin_id, "error": "No OHLCV data available"}
    
    # Compute indicators
    indicators = ind.compute_all_indicators(
        df,
        ema_periods=ema_periods,
        macd_params=macd_params,
        rsi_period=rsi_period,
        bb_window=bb_window,
        bb_std=bb_std
    )
    
    payload = {
        "symbol": sym,
        "coin_id": coin_id,
        "ohlcv": _df_to_ohlcv_dict(df),
        "indicators": indicators,
    }
    
    # Cache result
    try:
        cache_utils.set(cache_key, payload, ttl=TECHNICAL_CACHE_TTL_SECONDS)
    except Exception as e:
        logger.warning("Failed to cache TA indicators: %s", e)
    
    return payload


# -----------------------------------------------------------------------------
# Quant Metrics Tools
# -----------------------------------------------------------------------------

def get_raw_quant_metrics(
    symbol: str = "BTC",
    days: int = 365,
    risk_free_rate: float = 0.05
) -> Dict[str, Any]:
    """
    Compute quantitative metrics for a symbol.
    
    Returns:
    {
        "symbol": str,
        "metrics": {
            "returns": {
                "daily_mean": float,
                "daily_std": float,
                "annualized_return": float,
                "annualized_volatility": float
            },
            "risk": {
                "sharpe_ratio": float,
                "sortino_ratio": float,
                "max_drawdown": float,
                "calmar_ratio": float,
                "var_95": float,
                "cvar_95": float
            },
            "performance": {
                "total_return": float,
                "best_day": float,
                "worst_day": float,
                "positive_days_pct": float
            }
        }
    }
    """
    from data.fetch_market import fetch_ohlcv_data, get_supported_coins
    import numpy as np
    
    coins = get_supported_coins()
    coin_id = coins.get(symbol.upper(), symbol.lower())
    
    result = fetch_ohlcv_data(coin_id=coin_id, vs_currency="usd", days=days, interval="daily")
    
    if isinstance(result, dict) and result.get("error"):
        return {"symbol": symbol, "error": result["error"]}
    
    df: pd.DataFrame = result
    if df.empty or len(df) < 2:
        return {"symbol": symbol, "error": "Insufficient data for quant metrics"}
    
    # Calculate daily returns
    df = df.sort_values("timestamp")
    df["returns"] = df["close"].pct_change()
    returns = df["returns"].dropna()
    
    if len(returns) < 10:
        return {"symbol": symbol, "error": "Insufficient return data"}
    
    # Basic return stats
    daily_mean = float(returns.mean())
    daily_std = float(returns.std())
    annualized_return = daily_mean * 252
    annualized_vol = daily_std * np.sqrt(252)
    
    # Risk metrics
    excess_returns = returns - (risk_free_rate / 252)
    sharpe = float(excess_returns.mean() / excess_returns.std() * np.sqrt(252)) if excess_returns.std() > 0 else 0.0
    
    # Sortino (downside deviation)
    downside_returns = returns[returns < 0]
    downside_std = float(downside_returns.std()) if len(downside_returns) > 0 else 0.001
    sortino = float((daily_mean - risk_free_rate / 252) / downside_std * np.sqrt(252)) if downside_std > 0 else 0.0
    
    # Max drawdown
    cumulative = (1 + returns).cumprod()
    rolling_max = cumulative.cummax()
    drawdowns = (cumulative - rolling_max) / rolling_max
    max_drawdown = float(drawdowns.min())
    
    # Calmar ratio
    calmar = float(annualized_return / abs(max_drawdown)) if max_drawdown != 0 else 0.0
    
    # VaR and CVaR (95%)
    var_95 = float(np.percentile(returns, 5))
    cvar_95 = float(returns[returns <= var_95].mean()) if len(returns[returns <= var_95]) > 0 else var_95
    
    # Performance
    total_return = float((df["close"].iloc[-1] / df["close"].iloc[0]) - 1)
    best_day = float(returns.max())
    worst_day = float(returns.min())
    positive_days_pct = float((returns > 0).sum() / len(returns) * 100)
    
    return {
        "symbol": symbol,
        "metrics": {
            "returns": {
                "daily_mean": round(daily_mean, 6),
                "daily_std": round(daily_std, 6),
                "annualized_return": round(annualized_return, 4),
                "annualized_volatility": round(annualized_vol, 4)
            },
            "risk": {
                "sharpe_ratio": round(sharpe, 4),
                "sortino_ratio": round(sortino, 4),
                "max_drawdown": round(max_drawdown, 4),
                "calmar_ratio": round(calmar, 4),
                "var_95": round(var_95, 4),
                "cvar_95": round(cvar_95, 4)
            },
            "performance": {
                "total_return": round(total_return, 4),
                "best_day": round(best_day, 4),
                "worst_day": round(worst_day, 4),
                "positive_days_pct": round(positive_days_pct, 2)
            }
        }
    }
