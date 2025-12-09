from fastapi import APIRouter, HTTPException
import logging
from config import NEWS_STALE_HOURS
from data.tools import get_raw_news

router = APIRouter()
logger = logging.getLogger("crypto-sentinel")


@router.get("/news")
def get_latest_crypto_news(limit: int = 10, force: bool = False):
    """
    Return recent news items with per-headline sentiment.

    Flow:
    1. Check disk cache (if fresh within NEWS_STALE_HOURS)
    2. Fetch from Cryptopanic API if stale
    3. Compute sentiment per headline
    4. Embed into vector DB (if enabled)
    5. Return list of headlines + sentiment

    This endpoint returns RAW news data. It does NOT:
    - Run agentic summarization
    - Produce a final aggregated sentiment score (agents will do that)
    
    Frontend uses this endpoint.
    Agents use get_raw_news() tool function directly.
    """
    try:
        articles = get_raw_news(limit=limit, force_refresh=force)
        return {"articles": articles, "stale_threshold_hours": NEWS_STALE_HOURS}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in get_latest_crypto_news: %s", e)
        raise HTTPException(status_code=500, detail="something went wrong")
