"""
About endpoint - provides information about the Crypto Sentinel dashboard.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/about")
def get_about():
    """
    Return comprehensive information about the Crypto Sentinel dashboard.
    Used by the frontend to display the about/home page.
    """
    return {
        "name": "Crypto Sentinel",
        "tagline": "AI-Powered Cryptocurrency Intelligence Platform",
        "version": "1.0.0",
        "description": "Crypto Sentinel is an advanced cryptocurrency analysis platform that combines technical analysis, quantitative finance metrics, sentiment analysis, and AI-powered insights to help traders make informed decisions.",
        
        "features": [
            {
                "id": "technical",
                "title": "Technical Analysis",
                "icon": "📊",
                "description": "Real-time OHLCV charts with professional-grade technical indicators including EMA, MACD, RSI, and Bollinger Bands. Interactive charts with zoom and pan capabilities.",
                "highlights": [
                    "Multiple EMA periods (10, 20, 50)",
                    "MACD with signal line and histogram",
                    "RSI with overbought/oversold zones",
                    "Bollinger Bands for volatility analysis"
                ]
            },
            {
                "id": "quant",
                "title": "Quantitative Finance",
                "icon": "📈",
                "description": "Advanced quantitative metrics for deeper market analysis including volatility measures, trend strength indicators, market regime classification, and risk metrics.",
                "highlights": [
                    "Rolling volatility & ATR",
                    "ADX trend strength gauge",
                    "Market regime classification",
                    "Sharpe ratio & VATR metrics"
                ]
            },
            {
                "id": "sentiment",
                "title": "Sentiment Analysis",
                "icon": "🧠",
                "description": "AI-powered news sentiment analysis using state-of-the-art NLP models. Aggregates and analyzes crypto news to gauge market sentiment.",
                "highlights": [
                    "Real-time news aggregation",
                    "RoBERTa-based sentiment scoring",
                    "Per-headline sentiment labels",
                    "Historical sentiment trends"
                ]
            },
            {
                "id": "ai",
                "title": "AI Analysis",
                "icon": "🤖",
                "description": "Coming soon: Multi-agent AI system that synthesizes all data sources to provide comprehensive market insights and trading recommendations.",
                "highlights": [
                    "Multi-agent architecture",
                    "RAG-powered insights",
                    "Automated report generation",
                    "Strategy recommendations"
                ],
                "status": "coming_soon"
            }
        ],
        
        "supported_coins": [
            {"symbol": "BTC", "name": "Bitcoin", "id": "bitcoin"},
            {"symbol": "ETH", "name": "Ethereum", "id": "ethereum"},
            {"symbol": "SOL", "name": "Solana", "id": "solana"},
            {"symbol": "BNB", "name": "BNB", "id": "binancecoin"},
            {"symbol": "XRP", "name": "XRP", "id": "ripple"},
            {"symbol": "ADA", "name": "Cardano", "id": "cardano"},
            {"symbol": "DOGE", "name": "Dogecoin", "id": "dogecoin"}
        ],
        
        "data_sources": [
            {"name": "CoinGecko", "type": "Market Data", "description": "OHLCV prices, volume, market cap"},
            {"name": "CryptoPanic", "type": "News", "description": "Aggregated crypto news headlines"},
            {"name": "HuggingFace", "type": "AI Models", "description": "Sentiment analysis models"}
        ],
        
        "tech_stack": {
            "backend": ["FastAPI", "Python", "Pandas", "NumPy", "ChromaDB", "Transformers"],
            "frontend": ["Next.js", "React", "TypeScript", "TailwindCSS", "Chart.js"],
            "ai": ["LangChain", "HuggingFace Transformers", "Sentence Transformers"]
        },
        
        "metrics_formulas": {
            "ema": {
                "name": "Exponential Moving Average",
                "formula": "EMA[t] = α × Close[t] + (1-α) × EMA[t-1], where α = 2/(period+1)",
                "description": "Weighted moving average giving more weight to recent prices"
            },
            "macd": {
                "name": "Moving Average Convergence Divergence",
                "formula": "MACD = EMA(12) - EMA(26), Signal = EMA(MACD, 9)",
                "description": "Trend-following momentum indicator"
            },
            "rsi": {
                "name": "Relative Strength Index",
                "formula": "RSI = 100 - 100/(1 + RS), where RS = avg(gains)/avg(losses)",
                "description": "Momentum oscillator measuring speed of price changes"
            },
            "bollinger": {
                "name": "Bollinger Bands",
                "formula": "Upper = SMA(20) + 2σ, Lower = SMA(20) - 2σ",
                "description": "Volatility bands around a moving average"
            },
            "atr": {
                "name": "Average True Range",
                "formula": "ATR = EMA(TR, 14), TR = max(H-L, |H-Cp|, |L-Cp|)",
                "description": "Measures market volatility including gaps"
            },
            "adx": {
                "name": "Average Directional Index",
                "formula": "ADX = EMA(|+DI - -DI| / (+DI + -DI) × 100, 14)",
                "description": "Measures trend strength regardless of direction"
            },
            "sharpe": {
                "name": "Sharpe Ratio",
                "formula": "Sharpe = (Rp - Rf) / σp × √252",
                "description": "Risk-adjusted return metric"
            },
            "vatr": {
                "name": "Volatility-Adjusted Trend Ratio",
                "formula": "VATR = ADX / (Volatility × 100)",
                "description": "Custom metric measuring trend stability"
            }
        },
        
        "contact": {
            "github": "https://github.com/abdullah-mansoor3/crypto-sentinel",
            "author": "Abdullah Mansoor"
        }
    }
