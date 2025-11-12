import requests
from datetime import datetime
import pandas as pd

# ------------------------------------------
# Fetch OHLCV data from CoinGecko
# ------------------------------------------
def fetch_ohlcv_data(coin_id: str = "bitcoin", vs_currency: str = "usd", days: int = 30, interval: str = "daily"):
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

    url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
    params = {"vs_currency": vs_currency, "days": days, "interval": interval}

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        # Convert to DataFrame
        df = pd.DataFrame(data["prices"], columns=["timestamp", "price"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")

        # Optional fields: ohlc & volume
        if "market_caps" in data and "total_volumes" in data:
            volume_df = pd.DataFrame(data["total_volumes"], columns=["timestamp", "volume"])
            df["volume"] = volume_df["volume"]

        # CoinGecko returns only 'price' not full OHLCV, so we can approximate
        df["open"] = df["price"].shift(1)
        df["high"] = df["price"].rolling(3).max()
        df["low"] = df["price"].rolling(3).min()
        df["close"] = df["price"]

        df = df[["timestamp", "open", "high", "low", "close", "volume"]].dropna()
        return df

    except requests.exceptions.RequestException as e:
        return {"error": f"Request failed: {e}"}
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
