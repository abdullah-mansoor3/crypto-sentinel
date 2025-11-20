import requests
from datetime import datetime, timezone, timedelta
import time
import pandas as pd
import os
import json
import logging

# simple on-disk cache directory for stitched/coalesced responses
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# ------------------------------------------
# Fetch OHLCV data from CoinGecko
# ------------------------------------------
def fetch_ohlcv_data(coin_id: str = "bitcoin", vs_currency: str = "usd", days: int = 180, interval: str = "hourly"):
    """
    Fetch OHLCV data from CoinGecko API.
    
    Parameters:
        coin_id (str): CoinGecko coin id (e.g., "bitcoin", "ethereum", "solana")
        vs_currency (str): Quote currency (e.g., "usd")
        days (int): Number of past days to fetch (1, 7, 30, 90, 180, 365, or 'max')
        interval (str): Data granularity ('minutely', 'hourly', or 'daily')
    
    Returns:
        pd.DataFrame: DataFrame with columns [timestamp, open, high, low, close, volume]
    """

    base_url = f"https://api.coingecko.com/api/v3/coins/{coin_id}"
    url = f"{base_url}/market_chart"
    params = {"vs_currency": vs_currency, "days": days, "interval": interval}
    data = None

    # simple per-request cache (avoid re-hitting CoinGecko during development)
    cache_name_simple = f"coingecko_{coin_id}_{vs_currency}_{days}_{interval}.json"
    cache_path_simple = os.path.join(CACHE_DIR, cache_name_simple)
    try:
        if os.path.exists(cache_path_simple):
            mtime = os.path.getmtime(cache_path_simple)
            # if cache exists and is recent (< 1 hour), use it
            if time.time() - mtime < 3600:
                try:
                    with open(cache_path_simple, "r") as fh:
                        data = json.load(fh)
                except Exception:
                    data = None
    except Exception:
        pass

    def _normalize_cached_payload(payload):
        """Normalize different possible cached payload shapes into a dict
        with keys 'prices' and optionally 'total_volumes'.
        Accepts raw coingecko payload, or our higher-level cached payloads
        that may contain an 'ohlcv' section or be wrapped under 'value'."""
        if not payload:
            return None
        # if wrapped with {"value": ...} (from cache utils), unwrap
        if isinstance(payload, dict) and "value" in payload:
            payload = payload.get("value")

        # if payload already looks like coingecko response
        if isinstance(payload, dict) and payload.get("prices"):
            return {"prices": payload.get("prices"), "total_volumes": payload.get("total_volumes")}

        # if payload contains an 'ohlcv' dict (e.g., previously cached technical payload), reconstruct prices
        if isinstance(payload, dict) and payload.get("ohlcv"):
            o = payload.get("ohlcv")
            try:
                timestamps = o.get("timestamp") or o.get("timestamps")
                closes = o.get("close")
                volumes = o.get("volume") or o.get("volumes")
                if timestamps and closes:
                    prices = []
                    vols = []
                    for i, ts in enumerate(timestamps):
                        # try to parse ISO timestamp to ms since epoch
                        try:
                            if isinstance(ts, str):
                                dt = pd.to_datetime(ts)
                                ms = int(dt.timestamp() * 1000)
                            else:
                                # assume it's already ms
                                ms = int(ts)
                        except Exception:
                            continue
                        try:
                            price = float(closes[i])
                        except Exception:
                            price = None
                        prices.append([ms, price])
                        if volumes:
                            try:
                                vols.append([ms, float(volumes[i])])
                            except Exception:
                                vols.append([ms, None])
                    out = {"prices": prices}
                    if vols:
                        out["total_volumes"] = vols
                    return out
            except Exception:
                return None
        return None

    logger = logging.getLogger("crypto-sentinel.fetch_market")
    # if we found a fresh simple cache, normalize and use it directly to avoid network calls
    if data is not None:
        logger.debug("Found simple cache file: %s (size=%s)", cache_path_simple, os.path.getsize(cache_path_simple) if os.path.exists(cache_path_simple) else 'n/a')
        norm = _normalize_cached_payload(data)
        if norm is not None:
            data = norm
            logger.debug("Using normalized cached payload for %s", coin_id)
        else:
            logger.debug("Simple cache present but normalization failed, payload keys: %s", list(data.keys()) if isinstance(data, dict) else type(data))
        # otherwise leave data as-is and allow later fallbacks to handle it

    def _sleep_backoff(attempt: int):
        # exponential backoff with jitter; cap at 30s
        wait = min(30, (2 ** attempt))
        jitter = 0.2 * (attempt % 5)
        time.sleep(wait + jitter)

    def _do_request(params_local, max_attempts: int = 6):
        last_err = None
        for attempt in range(max_attempts):
            try:
                resp = requests.get(url, params=params_local, timeout=20)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.HTTPError as e:
                last_err = e
                # if rate limited, backoff and retry
                status = getattr(e.response, "status_code", None)
                if status == 429:
                    _sleep_backoff(attempt)
                    continue
                return {"_request_error": str(e)}
            except requests.exceptions.RequestException as e:
                last_err = e
                _sleep_backoff(attempt)
                continue
        return {"_request_error": str(last_err)}

    def _do_request_range(from_ts: int, to_ts: int, max_attempts: int = 6):
        range_url = f"{base_url}/market_chart/range"
        params_local = {"vs_currency": vs_currency, "from": from_ts, "to": to_ts}
        last_err = None
        for attempt in range(max_attempts):
            try:
                resp = requests.get(range_url, params=params_local, timeout=20)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.HTTPError as e:
                last_err = e
                status = getattr(e.response, "status_code", None)
                if status == 429:
                    _sleep_backoff(attempt)
                    continue
                return {"_request_error": str(e)}
            except requests.exceptions.RequestException as e:
                last_err = e
                _sleep_backoff(attempt)
                continue
        return {"_request_error": str(last_err)}

    # If requesting long hourly ranges, prefer fetching by range in chunks
    # Only perform range/chunk fetching when we don't already have a normalized cached payload
    if interval == "hourly" and days > 90 and (data is None or not (isinstance(data, dict) and data.get("prices"))):
        # fetch in chunks of at most 30 days using the range endpoint
        # Use an on-disk cache so repeated dev requests don't re-hit CoinGecko
        cache_name = f"coingecko_{coin_id}_{vs_currency}_{days}_{interval}.json"
        cache_path = os.path.join(CACHE_DIR, cache_name)
        try:
            if os.path.exists(cache_path):
                # if cache exists and is recent (< 1 hour), use it
                mtime = os.path.getmtime(cache_path)
                if time.time() - mtime < 3600:
                    try:
                        with open(cache_path, "r") as fh:
                            data = json.load(fh)
                        # basic sanity
                        if isinstance(data, dict) and data.get("prices"):
                            # continue to conversion logic below
                            pass
                    except Exception:
                        # fall through to re-fetch if cache is corrupt
                        data = None
        except Exception:
            pass

        now_ts = int(datetime.now(timezone.utc).timestamp())
        total_seconds = days * 24 * 3600
        start_ts = now_ts - total_seconds
        chunk_days = 30
        combined_prices = []
        combined_vols = []
        cur_start = start_ts
        while cur_start < now_ts:
            cur_end = min(now_ts, cur_start + chunk_days * 24 * 3600)
            resp = _do_request_range(cur_start, cur_end)
            if isinstance(resp, dict) and resp.get("_request_error"):
                data = resp
                break
            # collect prices & volumes
            ps = resp.get("prices", [])
            vs = resp.get("total_volumes", [])
            combined_prices.extend(ps)
            # volumes align by timestamp in many responses; just extend
            combined_vols.extend(vs)
            # advance
            cur_start = cur_end + 1
        if combined_prices:
            data = {"prices": combined_prices, "total_volumes": combined_vols}
            # persist stitched payload to disk for future dev calls
            try:
                with open(cache_path, "w") as fh:
                    json.dump(data, fh)
            except Exception:
                pass
        else:
            # fallback to single request approach
            data = _do_request(params)
    else:
        # First attempt with the requested params, but only if we don't already have cached data
        if data is None:
            data = _do_request(params)

    # If the response indicates an HTTP/request error, attempt fallbacks:
    if isinstance(data, dict) and data.get("_request_error"):
        # If hourly for a long period fails, try a shorter period (90 days)
        if interval == "hourly" and days > 90:
            params_short = {"vs_currency": vs_currency, "days": 90, "interval": "hourly"}
            data = _do_request(params_short)

        # If still failing or missing expected keys, try daily interval as a fallback
        if isinstance(data, dict) and data.get("_request_error"):
            params_daily = {"vs_currency": vs_currency, "days": days, "interval": "daily"}
            data = _do_request(params_daily)

    try:
        # Expect 'prices' key in the response
        if not data or not isinstance(data, dict) or "prices" not in data:
            # If data is an error dict, surface the message
            if isinstance(data, dict) and data.get("_request_error"):
                return {"error": data.get("_request_error")}
            return {"error": "Unexpected response from CoinGecko (missing prices)"}

        # Convert to DataFrame
        df = pd.DataFrame(data["prices"], columns=["timestamp", "price"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")

        # Optional fields: ohlc & volume
        if "total_volumes" in data:
            try:
                volume_df = pd.DataFrame(data["total_volumes"], columns=["timestamp", "volume"])
                df = df.merge(volume_df, on="timestamp", how="left")
            except Exception:
                df["volume"] = None
        else:
            df["volume"] = None

        # CoinGecko returns only 'price' for many endpoints; approximate OHLC
        df = df.sort_values("timestamp")
        df["open"] = df["price"].shift(1)
        df["high"] = df["price"].rolling(3, min_periods=1).max()
        df["low"] = df["price"].rolling(3, min_periods=1).min()
        df["close"] = df["price"]

        preview = df[["timestamp", "open", "high", "low", "close", "volume"]].head().to_dict()
        nulls = df[["timestamp", "open", "high", "low", "close", "volume"]].isnull().sum().to_dict()
        logger.debug("OHLCV preview=%s", preview)
        logger.debug("OHLCV nulls=%s", nulls)
        # Accept rows even when volume is missing (some caches may not include volumes)
        result_df = df[["timestamp", "open", "high", "low", "close", "volume"]].dropna(subset=["timestamp", "open", "high", "low", "close"])
        try:
            logger.debug("Prepared OHLCV dataframe rows=%s (original prices=%s)", len(result_df), len(data.get('prices', [])))
        except Exception:
            pass
        return result_df
    except Exception as e:
        return {"error": str(e)}


# ------------------------------------------
# Helper: get supported coins (limited)
# ------------------------------------------
def get_supported_coins():
    """
    Return a dictionary of supported coin IDs for analysis.
    These map user-friendly symbols to CoinGecko IDs.
    """
    return {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "BNB": "binancecoin",
        "XRP": "ripple",
        "ADA": "cardano",
        "DOGE": "dogecoin",
    }
