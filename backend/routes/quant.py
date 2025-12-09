from fastapi import APIRouter, Query, HTTPException
import logging
from typing import Optional
from data.tools import get_raw_quant_metrics

router = APIRouter()
logger = logging.getLogger("crypto-sentinel")


@router.get("/quant")
def get_quant_metrics(
    symbol: Optional[str] = Query("BTC"),
    days: Optional[int] = Query(365),
    risk_free_rate: Optional[float] = Query(0.05)
):
    """
    Return quantitative risk/return metrics for the requested symbol.
    
    Metrics include:
    - Returns: daily mean, std, annualized return/volatility
    - Risk: Sharpe ratio, Sortino ratio, max drawdown, Calmar ratio, VaR, CVaR
    - Performance: total return, best/worst day, positive days %
    
    This endpoint is for FRONTEND consumption.
    Agents use get_raw_quant_metrics() tool function directly.
    """
    sym = (symbol or "BTC").upper()
    
    try:
        result = get_raw_quant_metrics(
            symbol=sym,
            days=days,
            risk_free_rate=risk_free_rate
        )
        
        if result.get("error"):
            logger.error("Quant metrics error for %s: %s", sym, result.get("error"))
            raise HTTPException(status_code=502, detail=result.get("error"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in get_quant_metrics: %s", e)
        raise HTTPException(status_code=500, detail="something went wrong")