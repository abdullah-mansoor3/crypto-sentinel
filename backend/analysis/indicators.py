"""Technical indicator helpers used by the backend routes.

Functions expect a pandas.DataFrame with a 'close' column and return pandas.Series
or dicts of series. The outputs are safe to convert to lists/JSON for API responses.
"""
from typing import List, Dict
import pandas as pd


def ema(series: pd.Series, span: int) -> pd.Series:
	return series.ewm(span=span, adjust=False).mean()


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
	exp1 = series.ewm(span=fast, adjust=False).mean()
	exp2 = series.ewm(span=slow, adjust=False).mean()
	macd_line = exp1 - exp2
	signal_line = macd_line.ewm(span=signal, adjust=False).mean()
	hist = macd_line - signal_line
	return pd.DataFrame({"macd": macd_line, "signal": signal_line, "hist": hist})


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
	delta = series.diff()
	up = delta.clip(lower=0)
	down = -1 * delta.clip(upper=0)
	ma_up = up.ewm(alpha=1/period, adjust=False).mean()
	ma_down = down.ewm(alpha=1/period, adjust=False).mean()
	rs = ma_up / ma_down
	rsi = 100 - (100 / (1 + rs))
	return rsi


def bollinger_bands(series: pd.Series, window: int = 20, num_std: int = 2) -> pd.DataFrame:
	mid = series.rolling(window).mean()
	std = series.rolling(window).std()
	upper = mid + (std * num_std)
	lower = mid - (std * num_std)
	return pd.DataFrame({"mid": mid, "upper": upper, "lower": lower})


def compute_all_indicators(df: pd.DataFrame, ema_periods: List[int] = [20, 50, 100, 200],
						   macd_params: Dict = None, rsi_period: int = 14,
						   bb_window: int = 20, bb_std: int = 2) -> Dict:
	"""Compute a set of indicators and return them as JSON-serializable lists keyed by name.

	Returns a dict: {"ema": {period: [...]} , "macd": {...}, "rsi": [...], "bbands": {...}}
	"""
	if macd_params is None:
		macd_params = {"fast": 12, "slow": 26, "signal": 9}

	out = {}
	close = df["close"]

	def _to_list(series: pd.Series):
		lst = series.tolist()
		return [None if pd.isna(x) else (float(x) if isinstance(x, (int, float)) else x) for x in lst]

	# EMA
	out["ema"] = {}
	for p in ema_periods:
		out["ema"][str(p)] = _to_list(ema(close, p))

	# MACD
	macd_df = macd(close, **macd_params)
	out["macd"] = {k: _to_list(macd_df[k]) for k in macd_df.columns}

	# RSI
	out["rsi"] = _to_list(rsi(close, rsi_period))

	# Bollinger Bands
	bb = bollinger_bands(close, window=bb_window, num_std=bb_std)
	out["bbands"] = {k: _to_list(bb[k]) for k in bb.columns}

	return out

