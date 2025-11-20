from fastapi import APIRouter, HTTPException
import logging
from data.fetch_news import get_recent_articles, get_latest_article_time, fetch_and_store_latest, start_prune_scheduler, fetch_latest_from_cryptopanic, _read_news_cache, _write_news_cache
from utils import cache as cache_utils
from datetime import datetime, timezone, timedelta
from typing import Optional

router = APIRouter()
logger = logging.getLogger("crypto-sentinel")


@router.on_event("startup")
def _start_news_scheduler():
    # start daily pruning in the background
    try:
        start_prune_scheduler(interval_hours=24)
    except Exception:
        pass


@router.get("/news")
def get_latest_crypto_news(limit: int = 10):
    """Return recent news items with sentiment.

    Flow (preferred order): disk cache -> Chroma vector DB -> Cryptopanic API.
    If the latest news OR latest market candlestick is older than `NEWS_STALE_HOURS` (default 6h)
    the endpoint will attempt to re-fetch from the API, embed and upsert to Chroma and persist
    the disk cache.
    """
    NEWS_STALE_HOURS = 6
    try:
        # prefer disk cache if it's recent (< NEWS_STALE_HOURS)
        cached = _read_news_cache()
        if cached:
            try:
                # only consider disk cache valid if it actually contains articles
                articles = cached.get("articles") or []
                last = cached.get("last_fetched")
                if last and articles and len(articles) > 0:
                    last_dt = datetime.fromisoformat(last)
                    if datetime.now(timezone.utc) - last_dt < timedelta(hours=NEWS_STALE_HOURS):
                        return {"articles": articles[:limit]}
            except Exception:
                pass

        # helper: determine latest market candlestick time from TECH cache entries
        def _get_latest_candlestick_time() -> Optional[datetime]:
            try:
                keys = cache_utils.keys()
                latest = None
                for k in keys:
                    if not k.startswith("TECH::"):
                        continue
                    try:
                        payload = cache_utils.get(k)
                        if not payload:
                            continue
                        ohlcv = payload.get("ohlcv")
                        if not ohlcv:
                            continue
                        ts = ohlcv.get("timestamp")
                        if not ts:
                            continue
                        # timestamps are ISO strings; take last entry
                        last_ts = ts[-1]
                        try:
                            dt = datetime.fromisoformat(last_ts)
                        except Exception:
                            continue
                        if latest is None or (dt and dt > latest):
                            latest = dt
                    except Exception:
                        continue
                return latest
            except Exception:
                return None

        latest = get_latest_article_time()
        now = datetime.now(timezone.utc)
        # normalize latest if it's a string
        if latest is not None and isinstance(latest, str):
            try:
                latest = datetime.fromisoformat(latest)
            except Exception:
                latest = None

        latest_candle = _get_latest_candlestick_time()
        # determine if we need to fetch fresh articles: if either latest news or latest candle is older than threshold
        needs_fetch = False
        try:
            stale_delta = timedelta(hours=NEWS_STALE_HOURS)
            if latest is None or (now - latest) >= stale_delta:
                needs_fetch = True
            if latest_candle is None or (now - latest_candle) >= stale_delta:
                needs_fetch = True
        except Exception:
            needs_fetch = True

        # If we have up-to-date news in Chroma (latest within threshold), prefer returning that without re-fetch
        if not needs_fetch and latest is not None:
            articles = get_recent_articles(limit=limit)
            if articles:
                # ensure disk cache mirrors Chroma for fast startup
                try:
                    _write_news_cache(articles)
                except Exception:
                    pass
                return {"articles": articles}

        # If we need to fetch (or Chroma empty/stale), attempt fetch -> upsert -> cache
        if needs_fetch:
            try:
                fetch_and_store_latest(limit=20)
            except Exception as e:
                logger.exception("Failed to fetch latest news: %s", e)

        # Read from Chroma/vector DB (preferred over direct API)
        articles = get_recent_articles(limit=limit)
        if articles:
            # update disk cache for future cold-starts
            try:
                _write_news_cache(articles)
            except Exception:
                pass
            return {"articles": articles}

        # final fallback: direct API or disk cache
        try:
            articles = fetch_latest_from_cryptopanic(limit=limit)
        except Exception as e:
            logger.exception("Cryptopanic fetch failed: %s", e)
            articles = (cached.get("articles", [])[:limit] if cached else [])

        return {"articles": articles}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in get_latest_crypto_news: %s", e)
        raise HTTPException(status_code=500, detail="something went wrong")
