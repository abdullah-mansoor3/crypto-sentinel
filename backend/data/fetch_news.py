import requests
from datetime import datetime, timezone, timedelta
import time
import threading
from typing import List, Dict, Optional

from config import CRYPTOPANIC_API_KEY, EMBEDDINGS_ENABLED
import logging
import os
import json
from datetime import datetime

# disk cache
CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache"))
os.makedirs(CACHE_DIR, exist_ok=True)
NEWS_CACHE_PATH = os.path.join(CACHE_DIR, "news.json")
logger = logging.getLogger("crypto-sentinel.news")

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


def simple_sentiment(text: str) -> str:
    """Very small rule-based sentiment: returns 'positive', 'negative', or 'neutral'."""
    pos = {"good", "great", "bull", "surge", "gain", "rise", "positive", "up"}
    neg = {"bad", "bear", "drop", "loss", "fall", "negative", "down", "crash"}
    t = text.lower()
    score = 0
    for w in pos:
        if w in t:
            score += 1
    for w in neg:
        if w in t:
            score -= 1
    if score > 0:
        return "positive"
    if score < 0:
        return "negative"
    return "neutral"


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
