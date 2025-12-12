import requests
from datetime import datetime, timezone, timedelta
import time
import threading
from typing import List, Dict, Optional, Tuple
import hashlib
import re

from config import CRYPTOPANIC_API_KEY, EMBEDDINGS_ENABLED
import logging
import os
import json
from datetime import datetime

# disk cache
CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache"))
os.makedirs(CACHE_DIR, exist_ok=True)
NEWS_CACHE_PATH = os.path.join(CACHE_DIR, "news.json")
SENTIMENT_CACHE_PATH = os.path.join(CACHE_DIR, "sentiment_cache.json")
logger = logging.getLogger("crypto-sentinel.news")

# -----------------------------------------------------------------------------
# Sentiment Model (cardiffnlp/twitter-roberta-base-sentiment)
# -----------------------------------------------------------------------------
_sentiment_pipeline = None
_sentiment_cache: Dict[str, Tuple[str, float]] = {}
_sentiment_cache_lock = threading.Lock()


def _load_sentiment_cache():
    """Load sentiment cache from disk."""
    global _sentiment_cache
    try:
        if os.path.exists(SENTIMENT_CACHE_PATH):
            with open(SENTIMENT_CACHE_PATH, "r") as f:
                data = json.load(f)
                # Convert list values back to tuples
                _sentiment_cache = {k: tuple(v) for k, v in data.items()}
                logger.debug("Loaded %d sentiment cache entries", len(_sentiment_cache))
    except Exception as e:
        logger.warning("Failed to load sentiment cache: %s", e)
        _sentiment_cache = {}


def _save_sentiment_cache():
    """Persist sentiment cache to disk."""
    try:
        with _sentiment_cache_lock:
            # Convert tuples to lists for JSON serialization
            data = {k: list(v) for k, v in _sentiment_cache.items()}
        tmp = SENTIMENT_CACHE_PATH + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, SENTIMENT_CACHE_PATH)
    except Exception as e:
        logger.warning("Failed to save sentiment cache: %s", e)


def _get_text_hash(text: str) -> str:
    """Generate a short hash for text to use as cache key."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _get_sentiment_pipeline():
    """Lazy-load the sentiment analysis pipeline."""
    global _sentiment_pipeline
    if _sentiment_pipeline is not None:
        return _sentiment_pipeline
    
    try:
        from transformers import pipeline
        logger.info("Loading cardiffnlp/twitter-roberta-base-sentiment model...")
        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment",
            tokenizer="cardiffnlp/twitter-roberta-base-sentiment",
            top_k=None  # return all class scores
        )
        logger.info("Sentiment model loaded successfully")
        return _sentiment_pipeline
    except ImportError:
        logger.warning("transformers not installed; falling back to lexicon sentiment")
        return None
    except Exception as e:
        logger.exception("Failed to load sentiment model: %s", e)
        return None


def _clean_text_for_sentiment(text: str) -> str:
    """Clean and truncate text for sentiment analysis."""
    if not text:
        return ""
    t = text
    t = re.sub(r"https?://\S+", "", t)  # remove URLs
    t = re.sub(r"@\w+", "", t)  # remove mentions
    t = re.sub(r"\s+", " ", t).strip()
    return t[:512]  # RoBERTa max token limit is 512; truncate chars


# Load sentiment cache on module import
_load_sentiment_cache()


try:
    import chromadb
    from chromadb.utils import embedding_functions
except Exception:
    chromadb = None
    embedding_functions = None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class DummyEmbedding:
    """Fallback embedding function that returns zero vectors if sentence-transformers is not available."""
    def __init__(self, dim: int = 384):
        self.dim = dim

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [[0.0] * self.dim for _ in texts]

    def embed_query(self, text: str) -> List[float]:
        return [0.0] * self.dim


def _get_chroma_client():
    if chromadb is None:
        return None
    try:
        client = chromadb.Client()
        return client
    except Exception:
        return None


def _get_embedding_function():
    # allow disabling embeddings in development via config.EMBEDDINGS_ENABLED
    if not EMBEDDINGS_ENABLED:
        logger.debug("Embeddings disabled (EMBEDDINGS_ENABLED=false); using DummyEmbedding")
        return DummyEmbedding()

    # embeddings enabled: try to load sentence-transformers model
    if embedding_functions is not None:
        try:
            logger.debug("Loading SentenceTransformerEmbeddingFunction for all-MiniLM-L6-v2")
            return embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        except Exception as e:
            logger.exception("Failed to load SentenceTransformerEmbeddingFunction: %s", e)
            try:
                return embedding_functions.SentenceTransformerEmbeddingFunction(model_name="sentence-transformers/all-MiniLM-L6-v2")
            except Exception as e2:
                logger.exception("Fallback also failed: %s", e2)
                return DummyEmbedding()
    logger.warning("embedding_functions not available; using DummyEmbedding")
    return DummyEmbedding()


def _get_news_collection():
    client = _get_chroma_client()
    if client is None:
        return None
    emb = _get_embedding_function()
    # create or get collection
    try:
        coll = client.get_or_create_collection(name="news", embedding_function=emb)
        return coll
    except Exception:
        try:
            return client.get_collection("news")
        except Exception:
            return None


# Sentiment word lists with weights
POSITIVE_WORDS = {
    # Strong positive (weight 2)
    "soar": 2, "surge": 2, "skyrocket": 2, "moon": 2, "breakout": 2, "rally": 2,
    "bull": 2, "bullish": 2, "boom": 2, "milestone": 2, "record": 2, "ath": 2,
    # Moderate positive (weight 1)
    "rise": 1, "gain": 1, "up": 1, "grow": 1, "growth": 1, "positive": 1,
    "good": 1, "great": 1, "strong": 1, "buy": 1, "long": 1, "profit": 1,
    "recover": 1, "recovery": 1, "adoption": 1, "support": 1, "optimistic": 1,
    "outperform": 1, "upgrade": 1, "accumulate": 1, "accumulation": 1,
}

NEGATIVE_WORDS = {
    # Strong negative (weight 2)
    "crash": 2, "plunge": 2, "collapse": 2, "dump": 2, "tank": 2, "capitulate": 2,
    "bear": 2, "bearish": 2, "hack": 2, "scam": 2, "fraud": 2, "ban": 2,
    # Moderate negative (weight 1)
    "fall": 1, "drop": 1, "down": 1, "decline": 1, "loss": 1, "negative": 1,
    "bad": 1, "weak": 1, "sell": 1, "short": 1, "risk": 1, "fear": 1,
    "concern": 1, "worry": 1, "warning": 1, "downgrade": 1, "reject": 1,
    "volatile": 1, "volatility": 1, "uncertainty": 1, "correction": 1,
}


def simple_sentiment(text: str) -> str:
    """Very small rule-based sentiment: returns 'positive', 'negative', or 'neutral'."""
    label, _ = compute_sentiment(text)
    return label


def _compute_sentiment_lexicon(text: str) -> Tuple[str, float]:
    """
    Fallback lexicon-based sentiment analysis.
    
    Returns:
        tuple: (label: str, score: float)
    """
    if not text:
        return ("neutral", 0.0)
    
    t = text.lower()
    words = set(t.split())
    
    pos_score = 0
    neg_score = 0
    
    # Check for word matches
    for word in words:
        for pos_word, weight in POSITIVE_WORDS.items():
            if pos_word in word:
                pos_score += weight
                break
        for neg_word, weight in NEGATIVE_WORDS.items():
            if neg_word in word:
                neg_score += weight
                break
    
    # Also check for phrase matches in full text
    for pos_word, weight in POSITIVE_WORDS.items():
        if pos_word in t and pos_word not in words:
            pos_score += weight * 0.5
    
    for neg_word, weight in NEGATIVE_WORDS.items():
        if neg_word in t and neg_word not in words:
            neg_score += weight * 0.5
    
    raw_score = pos_score - neg_score
    
    if raw_score == 0:
        normalized_score = 0.0
    else:
        normalized_score = max(-1.0, min(1.0, raw_score / 6.0))
    
    if normalized_score > 0.1:
        label = "positive"
    elif normalized_score < -0.1:
        label = "negative"
    else:
        label = "neutral"
    
    return (label, round(normalized_score, 3))


def compute_sentiment(text: str, use_cache: bool = True) -> Tuple[str, float]:
    """
    Compute sentiment label and score for text using cardiffnlp/twitter-roberta-base-sentiment.
    
    Uses disk-backed cache to avoid recomputing sentiment for the same text.
    Falls back to lexicon-based sentiment if model is unavailable.
    
    Args:
        text: The text to analyze
        use_cache: Whether to use/update the sentiment cache (default True)
    
    Returns:
        tuple: (label: str, score: float)
            - label: "positive", "negative", or "neutral"
            - score: float from -1.0 (most negative) to 1.0 (most positive)
    """
    if not text:
        return ("neutral", 0.0)
    
    cleaned = _clean_text_for_sentiment(text)
    if not cleaned:
        return ("neutral", 0.0)
    
    # Check cache first
    text_hash = _get_text_hash(cleaned)
    if use_cache:
        with _sentiment_cache_lock:
            if text_hash in _sentiment_cache:
                cached = _sentiment_cache[text_hash]
                logger.debug("Sentiment cache hit for hash %s", text_hash)
                return cached
    
    # Try to use the RoBERTa model
    pipe = _get_sentiment_pipeline()
    if pipe is None:
        # Fallback to lexicon
        result = _compute_sentiment_lexicon(text)
    else:
        try:
            # cardiffnlp/twitter-roberta-base-sentiment with top_k=None returns:
            # [[{'label': 'LABEL_0', 'score': 0.xx}, {'label': 'LABEL_1', 'score': 0.xx}, {'label': 'LABEL_2', 'score': 0.xx}]]
            # Note: It's a list of lists when top_k=None
            # LABEL_0 = negative, LABEL_1 = neutral, LABEL_2 = positive
            outputs = pipe(cleaned, truncation=True, max_length=512)
            
            # Handle nested list structure from top_k=None
            if outputs and isinstance(outputs[0], list):
                outputs = outputs[0]
            
            # outputs is now a list of dicts with label and score
            # Extract probabilities for each class
            probs = {item["label"]: item["score"] for item in outputs}
            
            p_neg = probs.get("LABEL_0", probs.get("negative", 0.0))
            p_neu = probs.get("LABEL_1", probs.get("neutral", 0.0))
            p_pos = probs.get("LABEL_2", probs.get("positive", 0.0))
            
            # Compute score: p_pos - p_neg (range [-1, 1])
            score = p_pos - p_neg
            
            # Determine label based on highest probability
            if p_pos > p_neg and p_pos > p_neu:
                label = "positive"
            elif p_neg > p_pos and p_neg > p_neu:
                label = "negative"
            else:
                label = "neutral"
            
            result = (label, round(score, 3))
            
        except Exception as e:
            logger.warning("Sentiment model inference failed: %s; using lexicon fallback", e)
            result = _compute_sentiment_lexicon(text)
    
    # Update cache
    if use_cache:
        with _sentiment_cache_lock:
            _sentiment_cache[text_hash] = result
        # Periodically save cache to disk (every 10 new entries)
        if len(_sentiment_cache) % 10 == 0:
            _save_sentiment_cache()
    
    return result


def save_sentiment_cache():
    """Public function to force-save the sentiment cache to disk."""
    _save_sentiment_cache()


def fetch_latest_from_cryptopanic(limit: int = 20) -> List[Dict]:
    if not CRYPTOPANIC_API_KEY:
        # no api key: return empty list (caller should fall back to cache)
        return []
    url = f"https://cryptopanic.com/api/v1/posts/"
    params = {"auth_token": CRYPTOPANIC_API_KEY, "kind": "news", "public": True}
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])[:limit]
        out = []
        for r in results:
            published_at = r.get("published_at")
            try:
                dt = datetime.fromisoformat(published_at.replace("Z", "+00:00")) if published_at else _now_utc()
            except Exception:
                dt = _now_utc()
            item = {
                "id": str(r.get("id") or r.get("url") or r.get("published_at")),
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "published_at": dt.isoformat(),
                "content": r.get("body") or r.get("title") or "",
                "source": r.get("source", {}).get("domain") if isinstance(r.get("source"), dict) else None,
            }
            out.append(item)
        return out
    except requests.exceptions.RequestException as e:
        # surface empty to caller; caller will handle fallback
        return []


def _read_news_cache() -> Optional[Dict]:
    try:
        if not os.path.exists(NEWS_CACHE_PATH):
            return None
        with open(NEWS_CACHE_PATH, "r") as fh:
            return json.load(fh)
    except Exception as e:
        logger.exception("Failed to read news cache: %s", e)
        return None


def _write_news_cache(articles: List[Dict]):
    try:
        payload = {"last_fetched": datetime.now(timezone.utc).isoformat(), "articles": articles}
        tmp = NEWS_CACHE_PATH + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(payload, fh, default=str)
        try:
            os.replace(tmp, NEWS_CACHE_PATH)
        except Exception:
            try:
                os.rename(tmp, NEWS_CACHE_PATH)
            except Exception:
                # final attempt: write directly
                with open(NEWS_CACHE_PATH, "w") as fh:
                    json.dump(payload, fh, default=str)
        logger.debug("Wrote news cache (%d articles) to %s", len(articles or []), NEWS_CACHE_PATH)
    except Exception as e:
        logger.exception("Failed to write news cache: %s", e)


def upsert_articles_to_vector_db(articles: List[Dict]) -> None:
    coll = _get_news_collection()
    if coll is None:
        # can't store; skip
        # still persist to local cache so frontend can use it
        try:
            _write_news_cache(articles)
        except Exception:
            pass
        return

    ids = []
    metadatas = []
    documents = []
    texts = []
    for a in articles:
        ids.append(a["id"])
        text = (a.get("title", "") or "") + "\n" + (a.get("content", "") or "")
        texts.append(text)
        documents.append(a.get("title", ""))
        metadatas.append({"url": a.get("url"), "published_at": a.get("published_at"), "source": a.get("source"), "sentiment": simple_sentiment(text)})

    try:
        # embed via collection's embedding function if available
        try:
            embeddings = coll._embedding_function.embed_documents(texts)  # type: ignore[attr-defined]
        except Exception:
            # fallback: let chroma embed if collection has embedding_function set
            embeddings = None

        if embeddings is not None:
            coll.add(ids=ids, metadatas=metadatas, documents=documents, embeddings=embeddings)
        else:
            coll.add(ids=ids, metadatas=metadatas, documents=documents)
    except Exception:
        # if add fails (e.g., id exists), try upsert semantics by deleting identical ids then add
        try:
            coll.delete(ids=ids)
            coll.add(ids=ids, metadatas=metadatas, documents=documents)
        except Exception:
            pass


def get_recent_articles(limit: int = 10) -> List[Dict]:
    coll = _get_news_collection()
    if coll is None:
        # fall back to disk cache
        cached = _read_news_cache()
        if cached and isinstance(cached.get("articles"), list):
            return cached.get("articles")[:limit]
        return []
    try:
        res = coll.get(include=["metadatas", "documents", "ids"], limit=1000)
        metadatas = res.get("metadatas", [])
        documents = res.get("documents", [])
        ids = res.get("ids", [])
        items = []
        for i, mid in enumerate(metadatas):
            pub = mid.get("published_at")
            try:
                dt = datetime.fromisoformat(pub) if pub else _now_utc()
            except Exception:
                dt = _now_utc()
            items.append({"id": ids[i], "title": documents[i], "url": mid.get("url"), "published_at": dt, "sentiment": mid.get("sentiment")})
        # sort by published_at desc
        items.sort(key=lambda x: x.get("published_at") or _now_utc(), reverse=True)
        # convert published_at to iso
        out = []
        for it in items[:limit]:
            out.append({"id": it["id"], "title": it["title"], "url": it.get("url"), "published_at": (it.get("published_at").isoformat() if isinstance(it.get("published_at"), datetime) else str(it.get("published_at"))), "sentiment": it.get("sentiment")})
        return out
    except Exception:
        # on failure, try disk cache
        cached = _read_news_cache()
        if cached and isinstance(cached.get("articles"), list):
            return cached.get("articles")[:limit]
        return []


def get_latest_article_time() -> Optional[datetime]:
    coll = _get_news_collection()
    if coll is None:
        # check disk cache
        cached = _read_news_cache()
        if not cached:
            return None
        try:
            lf = cached.get("last_fetched")
            if lf:
                return datetime.fromisoformat(lf)
        except Exception:
            return None
        return None
    try:
        res = coll.get(include=["metadatas"], limit=1000)
        metadatas = res.get("metadatas", [])
        latest = None
        for m in metadatas:
            pub = m.get("published_at")
            try:
                dt = datetime.fromisoformat(pub) if pub else None
            except Exception:
                dt = None
            if dt and (latest is None or dt > latest):
                latest = dt
        return latest
    except Exception:
        return None


def fetch_and_store_latest(limit: int = 20) -> List[Dict]:
    articles = fetch_latest_from_cryptopanic(limit=limit)
    # always persist the fetch attempt to disk (helps with cold starts and avoids repeated API calls)
    try:
        _write_news_cache(articles)
    except Exception:
        pass

    if not articles:
        # API returned no articles. Prefer vector DB content if available.
        try:
            from data.fetch_news import get_recent_articles as _get_recent
        except Exception:
            _get_recent = None

        if _get_recent:
            try:
                recent = _get_recent(limit=limit)
                if recent:
                    return recent
            except Exception:
                pass

        # otherwise return disk cache if present (may be empty)
        cached = _read_news_cache()
        if cached and isinstance(cached.get("articles"), list):
            return cached.get("articles")[:limit]
        return []

    # upsert into vector DB (if available)
    upsert_articles_to_vector_db(articles)
    # return the vector DB view (may be enriched with metadata)
    return get_recent_articles(limit=limit)


def prune_old_news(days: int = 30) -> None:
    coll = _get_news_collection()
    if coll is None:
        return
    cutoff = _now_utc() - timedelta(days=days)
    try:
        res = coll.get(include=["metadatas", "ids"], limit=10000)
        metadatas = res.get("metadatas", [])
        ids = res.get("ids", [])
        to_delete = []
        for i, m in enumerate(metadatas):
            pub = m.get("published_at")
            try:
                dt = datetime.fromisoformat(pub) if pub else None
            except Exception:
                dt = None
            if dt and dt < cutoff:
                to_delete.append(ids[i])
        if to_delete:
            coll.delete(ids=to_delete)
    except Exception:
        pass


def start_prune_scheduler(interval_hours: int = 24):
    """Start a background thread that prunes old news every interval_hours."""
    def loop():
        while True:
            try:
                prune_old_news(days=30)
            except Exception:
                pass
            time.sleep(interval_hours * 3600)

    t = threading.Thread(target=loop, daemon=True)
    t.start()
