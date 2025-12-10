"""
Quantitative Finance Metrics Module

Computes advanced trading metrics from OHLCV data:
- Volatility Metrics (Rolling Std, ATR)
- Trend Strength Metrics (ADX)
- Market Structure Metrics (Regime Classification, Volume-Price Analysis)
- Risk & Liquidity Metrics (Sharpe-like, Liquidity Score, VATR)
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple


# =============================================================================
# VOLATILITY METRICS
# =============================================================================

def rolling_volatility(close: pd.Series, windows: List[int] = [7, 14, 30]) -> Dict[str, List[float]]:
    """
    Compute rolling standard deviation of returns over multiple windows.
    
    Formula: std(pct_change(close)) over window
    
    Args:
        close: Series of close prices
        windows: List of window sizes in periods
    
    Returns:
        Dict with window size as key and volatility series as value
    """
    returns = close.pct_change()
    result = {}
    for w in windows:
        vol = returns.rolling(window=w).std() * np.sqrt(w)  # Annualize roughly
        result[str(w)] = [None if pd.isna(v) else round(float(v), 6) for v in vol]
    return result


def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> Tuple[List[float], str]:
    """
    Average True Range - measures volatility including gaps.
    
    Formula:
        TR = max(high - low, abs(high - prev_close), abs(low - prev_close))
        ATR = EMA(TR, period)
    
    Args:
        high, low, close: OHLC series
        period: ATR period (default 14)
    
    Returns:
        Tuple of (ATR values list, trend direction "rising"/"falling"/"stable")
    """
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    atr_values = tr.ewm(span=period, adjust=False).mean()
    atr_list = [None if pd.isna(v) else round(float(v), 4) for v in atr_values]
    
    # Determine trend
    if len(atr_values) >= 5:
        recent = atr_values.iloc[-5:].dropna()
        if len(recent) >= 2:
            change = (recent.iloc[-1] - recent.iloc[0]) / (recent.iloc[0] + 1e-10)
            if change > 0.05:
                trend = "rising"
            elif change < -0.05:
                trend = "falling"
            else:
                trend = "stable"
        else:
            trend = "stable"
    else:
        trend = "stable"
    
    return atr_list, trend


def classify_volatility(volatility_30d: float) -> str:
    """Classify volatility level."""
    if volatility_30d is None:
        return "unknown"
    if volatility_30d < 0.02:
        return "low"
    elif volatility_30d < 0.05:
        return "medium"
    else:
        return "high"


# =============================================================================
# TREND STRENGTH METRICS
# =============================================================================

def adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> Tuple[List[float], str, float]:
    """
    Average Directional Index - measures trend strength (not direction).
    
    Formula:
        +DM = high - prev_high (if positive and > -DM, else 0)
        -DM = prev_low - low (if positive and > +DM, else 0)
        +DI = 100 * EMA(+DM) / ATR
        -DI = 100 * EMA(-DM) / ATR
        DX = 100 * |+DI - -DI| / (+DI + -DI)
        ADX = EMA(DX, period)
    
    Interpretation:
        < 20: weak/no trend
        20-40: medium trend
        > 40: strong trend
    
    Returns:
        Tuple of (ADX values, trend_strength_label, latest_adx)
    """
    # Calculate +DM and -DM
    high_diff = high.diff()
    low_diff = -low.diff()
    
    plus_dm = pd.Series(np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0), index=high.index)
    minus_dm = pd.Series(np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0), index=low.index)
    
    # Calculate TR and ATR
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)
    
    atr_val = tr.ewm(span=period, adjust=False).mean()
    
    # Calculate +DI and -DI
    plus_di = 100 * plus_dm.ewm(span=period, adjust=False).mean() / (atr_val + 1e-10)
    minus_di = 100 * minus_dm.ewm(span=period, adjust=False).mean() / (atr_val + 1e-10)
    
    # Calculate DX and ADX
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-10)
    adx_values = dx.ewm(span=period, adjust=False).mean()
    
    adx_list = [None if pd.isna(v) else round(float(v), 2) for v in adx_values]
    
    # Get latest ADX and classify
    latest_adx = adx_values.iloc[-1] if len(adx_values) > 0 and not pd.isna(adx_values.iloc[-1]) else 0
    
    if latest_adx < 20:
        strength = "weak"
    elif latest_adx < 40:
        strength = "medium"
    else:
        strength = "strong"
    
    return adx_list, strength, round(float(latest_adx), 2)


# =============================================================================
# MARKET STRUCTURE METRICS
# =============================================================================

def classify_market_regime(
    close: pd.Series,
    adx_value: float,
    volatility: float,
    returns_mean: float
) -> Tuple[str, Dict[str, float]]:
    """
    Classify market into regime categories.
    
    Categories:
        - Bullish: positive returns, medium-strong trend
        - Bearish: negative returns, medium-strong trend
        - Ranging: weak trend, low volatility
        - Volatile Chop: weak trend, high volatility
    
    Returns:
        Tuple of (regime_label, probability_dict)
    """
    probabilities = {"bullish": 0.0, "bearish": 0.0, "ranging": 0.0, "volatile_chop": 0.0}
    
    # Calculate regime scores
    trend_strong = adx_value >= 25
    trend_weak = adx_value < 20
    vol_high = volatility > 0.04
    vol_low = volatility < 0.02
    returns_pos = returns_mean > 0.001
    returns_neg = returns_mean < -0.001
    
    if trend_strong and returns_pos:
        probabilities["bullish"] = 0.7 + min(0.3, adx_value / 100)
    elif trend_strong and returns_neg:
        probabilities["bearish"] = 0.7 + min(0.3, adx_value / 100)
    elif trend_weak and vol_high:
        probabilities["volatile_chop"] = 0.6 + min(0.4, volatility * 5)
    elif trend_weak and vol_low:
        probabilities["ranging"] = 0.7 + min(0.3, (20 - adx_value) / 20)
    else:
        # Mixed signals
        if returns_pos:
            probabilities["bullish"] = 0.4
            probabilities["ranging"] = 0.3
        elif returns_neg:
            probabilities["bearish"] = 0.4
            probabilities["ranging"] = 0.3
        else:
            probabilities["ranging"] = 0.5
        probabilities["volatile_chop"] = volatility * 5
    
    # Normalize
    total = sum(probabilities.values())
    if total > 0:
        probabilities = {k: round(v / total, 3) for k, v in probabilities.items()}
    
    # Determine primary regime
    regime = max(probabilities, key=probabilities.get)
    
    return regime, probabilities


def obv_trend(close: pd.Series, volume: pd.Series, period: int = 20) -> Tuple[List[float], str, bool]:
    """
    On-Balance Volume trend analysis.
    
    Formula:
        OBV += volume if close > prev_close
        OBV -= volume if close < prev_close
        OBV unchanged if close == prev_close
    
    Returns:
        Tuple of (OBV values, trend direction "up"/"down"/"flat", volume_confirms_price)
    """
    obv = pd.Series(0.0, index=close.index)
    
    for i in range(1, len(close)):
        if pd.isna(close.iloc[i]) or pd.isna(close.iloc[i-1]):
            obv.iloc[i] = obv.iloc[i-1]
        elif close.iloc[i] > close.iloc[i-1]:
            obv.iloc[i] = obv.iloc[i-1] + (volume.iloc[i] if not pd.isna(volume.iloc[i]) else 0)
        elif close.iloc[i] < close.iloc[i-1]:
            obv.iloc[i] = obv.iloc[i-1] - (volume.iloc[i] if not pd.isna(volume.iloc[i]) else 0)
        else:
            obv.iloc[i] = obv.iloc[i-1]
    
    obv_list = [round(float(v), 2) for v in obv]
    
    # Determine OBV trend
    if len(obv) >= period:
        obv_sma = obv.rolling(window=period).mean()
        recent_obv = obv.iloc[-1]
        recent_sma = obv_sma.iloc[-1]
        
        if not pd.isna(recent_sma):
            if recent_obv > recent_sma * 1.02:
                obv_direction = "up"
            elif recent_obv < recent_sma * 0.98:
                obv_direction = "down"
            else:
                obv_direction = "flat"
        else:
            obv_direction = "flat"
    else:
        obv_direction = "flat"
    
    # Check if volume confirms price trend
    price_trend = "up" if close.iloc[-1] > close.iloc[-min(period, len(close))] else "down"
    volume_confirms = (price_trend == "up" and obv_direction == "up") or \
                      (price_trend == "down" and obv_direction == "down")
    
    return obv_list, obv_direction, volume_confirms


# =============================================================================
# RISK & LIQUIDITY METRICS
# =============================================================================

def sharpe_ratio(close: pd.Series, risk_free_rate: float = 0.05, periods_per_year: int = 365) -> float:
    """
    Compute Sharpe-like ratio for crypto.
    
    Formula:
        Sharpe = (mean(returns) - risk_free_rate/periods) / std(returns) * sqrt(periods_per_year)
    
    Interpretation:
        < 0: bad
        0-1: suboptimal
        1-2: good
        > 2: excellent
    """
    returns = close.pct_change().dropna()
    if len(returns) < 2:
        return 0.0
    
    excess_return = returns.mean() - (risk_free_rate / periods_per_year)
    volatility = returns.std()
    
    if volatility == 0:
        return 0.0
    
    sharpe = (excess_return / volatility) * np.sqrt(periods_per_year)
    return round(float(sharpe), 3)


def classify_sharpe(sharpe: float) -> str:
    """Classify Sharpe ratio quality."""
    if sharpe < 0:
        return "poor"
    elif sharpe < 1:
        return "suboptimal"
    elif sharpe < 2:
        return "good"
    else:
        return "excellent"


def liquidity_score(volume_24h: float, market_cap: float) -> Tuple[float, str]:
    """
    Compute liquidity score based on volume/market_cap ratio.
    
    Formula:
        liquidity_ratio = volume_24h / market_cap
    
    Interpretation:
        < 0.01: low liquidity
        0.01-0.05: medium liquidity
        > 0.05: high liquidity
    """
    if market_cap <= 0:
        return 0.0, "unknown"
    
    ratio = volume_24h / market_cap
    
    if ratio < 0.01:
        level = "low"
    elif ratio < 0.05:
        level = "medium"
    else:
        level = "high"
    
    return round(ratio, 4), level


def vatr(adx_value: float, volatility: float) -> Tuple[float, str]:
    """
    Volatility-Adjusted Trend Ratio (custom metric).
    
    Formula:
        VATR = trend_strength / volatility
    
    Interpretation:
        High VATR (>50): Strong trend with stable volatility (good conditions)
        Low VATR (<20): Weak trend or high volatility (avoid)
    """
    if volatility <= 0:
        volatility = 0.001  # Avoid division by zero
    
    vatr_value = adx_value / (volatility * 100)  # Scale volatility to percentage
    
    if vatr_value > 50:
        label = "stable_trend"
    elif vatr_value > 20:
        label = "moderate"
    else:
        label = "unstable"
    
    return round(vatr_value, 2), label


# =============================================================================
# MAIN COMPUTATION FUNCTION
# =============================================================================

def compute_all_quant_metrics(
    df: pd.DataFrame,
    volume_24h: Optional[float] = None,
    market_cap: Optional[float] = None,
    risk_free_rate: float = 0.05
) -> Dict[str, Any]:
    """
    Compute all quantitative finance metrics from OHLCV data.
    
    Args:
        df: DataFrame with columns [timestamp, open, high, low, close, volume]
        volume_24h: 24h trading volume (optional, for liquidity score)
        market_cap: Market cap (optional, for liquidity score)
        risk_free_rate: Annual risk-free rate for Sharpe calculation
    
    Returns:
        Dict containing all quant metrics with values, labels, and formulas
    """
    result = {
        "volatility": {},
        "trend": {},
        "market_structure": {},
        "risk_liquidity": {},
        "formulas": {}
    }
    
    # Ensure proper dtypes
    close = df["close"].astype(float)
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    volume = df["volume"].astype(float) if "volume" in df.columns else pd.Series([0] * len(df))
    
    # ==========================================================================
    # VOLATILITY METRICS
    # ==========================================================================
    
    # Rolling volatility
    vol_data = rolling_volatility(close, windows=[7, 14, 30])
    latest_vol_30 = None
    for v in reversed(vol_data.get("30", [])):
        if v is not None:
            latest_vol_30 = v
            break
    
    result["volatility"]["rolling_std"] = {
        "values": vol_data,
        "latest_30d": latest_vol_30,
        "level": classify_volatility(latest_vol_30)
    }
    
    # ATR
    atr_values, atr_trend = atr(high, low, close)
    latest_atr = None
    for v in reversed(atr_values):
        if v is not None:
            latest_atr = v
            break
    
    result["volatility"]["atr"] = {
        "values": atr_values,
        "latest": latest_atr,
        "trend": atr_trend
    }
    
    # ==========================================================================
    # TREND STRENGTH METRICS
    # ==========================================================================
    
    adx_values, adx_strength, latest_adx = adx(high, low, close)
    
    result["trend"]["adx"] = {
        "values": adx_values,
        "latest": latest_adx,
        "strength": adx_strength
    }
    
    # ==========================================================================
    # MARKET STRUCTURE METRICS
    # ==========================================================================
    
    # Calculate returns for regime classification
    returns = close.pct_change().dropna()
    returns_mean = returns.mean() if len(returns) > 0 else 0
    
    regime, regime_probs = classify_market_regime(
        close,
        latest_adx,
        latest_vol_30 if latest_vol_30 else 0.03,
        returns_mean
    )
    
    result["market_structure"]["regime"] = {
        "current": regime,
        "probabilities": regime_probs
    }
    
    # OBV
    obv_values, obv_direction, vol_confirms = obv_trend(close, volume)
    
    result["market_structure"]["obv"] = {
        "values": obv_values,
        "trend": obv_direction,
        "volume_confirms_price": vol_confirms
    }
    
    # ==========================================================================
    # RISK & LIQUIDITY METRICS
    # ==========================================================================
    
    sharpe = sharpe_ratio(close, risk_free_rate)
    
    result["risk_liquidity"]["sharpe"] = {
        "value": sharpe,
        "quality": classify_sharpe(sharpe)
    }
    
    # Liquidity score
    if volume_24h and market_cap:
        liq_ratio, liq_level = liquidity_score(volume_24h, market_cap)
        result["risk_liquidity"]["liquidity"] = {
            "ratio": liq_ratio,
            "level": liq_level
        }
    else:
        # Estimate from volume data
        avg_vol = volume.tail(24).mean() if len(volume) >= 24 else volume.mean()
        result["risk_liquidity"]["liquidity"] = {
            "avg_volume_24h": round(float(avg_vol), 2) if not pd.isna(avg_vol) else None,
            "level": "estimated"
        }
    
    # VATR
    vatr_value, vatr_label = vatr(latest_adx, latest_vol_30 if latest_vol_30 else 0.03)
    
    result["risk_liquidity"]["vatr"] = {
        "value": vatr_value,
        "label": vatr_label
    }
    
    # ==========================================================================
    # FORMULAS (for frontend tooltip display)
    # ==========================================================================
    
    result["formulas"] = {
        "rolling_volatility": "σ = std(returns) × √window, where returns = (close[t] - close[t-1]) / close[t-1]",
        "atr": "ATR = EMA(TR, 14), where TR = max(high - low, |high - prev_close|, |low - prev_close|)",
        "adx": "ADX = EMA(DX, 14), where DX = 100 × |+DI - -DI| / (+DI + -DI)",
        "market_regime": "Classification based on ADX (trend strength), volatility level, and return direction",
        "obv": "OBV[t] = OBV[t-1] + volume if close > prev_close, else OBV[t-1] - volume",
        "sharpe": "Sharpe = (mean(returns) - rf/365) / std(returns) × √365",
        "liquidity": "Liquidity Ratio = Volume(24h) / Market Cap",
        "vatr": "VATR = ADX / (Volatility × 100) - measures trend stability"
    }
    
    return result
