"""
MCP-style schemas for multi-agent crypto analysis pipeline.
Each agent has schema-validated inputs and outputs using Pydantic.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


# =============================================================================
# NEWS SENTIMENT AGENT SCHEMAS
# =============================================================================

class NewsAgentInput(BaseModel):
    """Input schema for News Sentiment Agent"""
    coin: str = Field(..., description="Cryptocurrency symbol (e.g., 'BTC', 'ETH')")
    query: Optional[str] = Field(None, description="Optional search query for news filtering")
    
    class Config:
        json_schema_extra = {
            "example": {
                "coin": "BTC",
                "query": "price movement"
            }
        }


class NewsEvent(BaseModel):
    """Single news event with sentiment"""
    title: str = Field(..., description="News headline")
    sentiment: Literal["positive", "negative", "neutral"] = Field(..., description="Sentiment classification")
    sentiment_score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment score from -1 to 1")
    source: Optional[str] = Field(None, description="News source")
    published_at: Optional[str] = Field(None, description="Publication timestamp")


class NewsAgentOutput(BaseModel):
    """Output schema for News Sentiment Agent"""
    sentiment_summary: str = Field(..., description="Natural language summary of overall market sentiment")
    avg_sentiment_score: float = Field(..., ge=-1.0, le=1.0, description="Average sentiment score across all news")
    overall_sentiment: Literal["bullish", "bearish", "neutral"] = Field(..., description="Overall sentiment classification")
    top_events: List[NewsEvent] = Field(..., description="Top news events by relevance/impact")
    news_count: int = Field(..., description="Total number of news articles analyzed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "sentiment_summary": "Market sentiment is cautiously optimistic with Bitcoin ETF inflows driving positive momentum",
                "avg_sentiment_score": 0.35,
                "overall_sentiment": "bullish",
                "top_events": [
                    {
                        "title": "Bitcoin ETF sees record inflows",
                        "sentiment": "positive",
                        "sentiment_score": 0.85,
                        "source": "CryptoPanic",
                        "published_at": "2024-01-15T10:00:00Z"
                    }
                ],
                "news_count": 15
            }
        }


# =============================================================================
# TECHNICAL ANALYSIS AGENT SCHEMAS
# =============================================================================

class TechnicalAgentInput(BaseModel):
    """Input schema for Technical Analysis Agent"""
    coin: str = Field(..., description="Cryptocurrency symbol (e.g., 'BTC', 'ETH')")
    days: int = Field(default=30, ge=7, le=365, description="Number of days for analysis")
    
    class Config:
        json_schema_extra = {
            "example": {
                "coin": "BTC",
                "days": 30
            }
        }


class IndicatorSignal(BaseModel):
    """Single technical indicator signal"""
    indicator: str = Field(..., description="Indicator name (RSI, MACD, etc.)")
    value: float = Field(..., description="Current indicator value")
    signal: Literal["bullish", "bearish", "neutral"] = Field(..., description="Signal interpretation")
    description: str = Field(..., description="Human-readable description")


class KeyLevel(BaseModel):
    """Support/Resistance level"""
    level_type: Literal["support", "resistance"] = Field(..., description="Type of level")
    price: float = Field(..., description="Price level")
    strength: Literal["strong", "moderate", "weak"] = Field(..., description="Level strength")


class TechnicalAgentOutput(BaseModel):
    """Output schema for Technical Analysis Agent"""
    trend_summary: str = Field(..., description="Natural language summary of current trend")
    overall_trend: Literal["bullish", "bearish", "neutral", "mixed"] = Field(..., description="Overall trend classification")
    key_levels: List[KeyLevel] = Field(..., description="Important support/resistance levels")
    indicator_signals: List[IndicatorSignal] = Field(..., description="Individual indicator signals")
    current_price: float = Field(..., description="Current price")
    price_change_pct: float = Field(..., description="Price change percentage over analysis period")
    
    class Config:
        json_schema_extra = {
            "example": {
                "trend_summary": "BTC is showing bullish momentum with RSI at healthy levels and MACD crossing upward",
                "overall_trend": "bullish",
                "key_levels": [
                    {"level_type": "support", "price": 42000, "strength": "strong"},
                    {"level_type": "resistance", "price": 48000, "strength": "moderate"}
                ],
                "indicator_signals": [
                    {"indicator": "RSI", "value": 58.5, "signal": "neutral", "description": "RSI at healthy levels, not overbought or oversold"},
                    {"indicator": "MACD", "value": 150.2, "signal": "bullish", "description": "MACD line above signal line"}
                ],
                "current_price": 45000,
                "price_change_pct": 5.2
            }
        }


# =============================================================================
# QUANTITATIVE METRICS AGENT SCHEMAS
# =============================================================================

class QuantAgentInput(BaseModel):
    """Input schema for Quantitative Metrics Agent"""
    coin: str = Field(..., description="Cryptocurrency symbol (e.g., 'BTC', 'ETH')")
    days: int = Field(default=30, ge=7, le=365, description="Number of days for analysis")
    
    class Config:
        json_schema_extra = {
            "example": {
                "coin": "BTC",
                "days": 30
            }
        }


class ReturnMetrics(BaseModel):
    """Return-related metrics"""
    total_return: float = Field(..., description="Total return percentage")
    annualized_return: float = Field(..., description="Annualized return percentage")
    daily_avg_return: float = Field(..., description="Average daily return percentage")
    best_day: float = Field(..., description="Best single day return percentage")
    worst_day: float = Field(..., description="Worst single day return percentage")


class RiskMetrics(BaseModel):
    """Risk-related metrics"""
    volatility: float = Field(..., description="Annualized volatility percentage")
    sharpe_ratio: float = Field(..., description="Sharpe ratio (risk-adjusted return)")
    sortino_ratio: float = Field(..., description="Sortino ratio (downside risk-adjusted)")
    max_drawdown: float = Field(..., description="Maximum drawdown percentage")
    var_95: float = Field(..., description="Value at Risk at 95% confidence")
    cvar_95: float = Field(..., description="Conditional VaR (Expected Shortfall)")


class QuantAgentOutput(BaseModel):
    """Output schema for Quantitative Metrics Agent"""
    risk_summary: str = Field(..., description="Natural language summary of risk profile")
    risk_level: Literal["low", "moderate", "high", "extreme"] = Field(..., description="Overall risk classification")
    return_metrics: ReturnMetrics = Field(..., description="Return-related metrics")
    risk_metrics: RiskMetrics = Field(..., description="Risk-related metrics")
    risk_reward_assessment: str = Field(..., description="Risk/reward assessment")
    
    class Config:
        json_schema_extra = {
            "example": {
                "risk_summary": "BTC shows moderate volatility with favorable risk-adjusted returns",
                "risk_level": "moderate",
                "return_metrics": {
                    "total_return": 15.5,
                    "annualized_return": 186.0,
                    "daily_avg_return": 0.52,
                    "best_day": 8.2,
                    "worst_day": -5.1
                },
                "risk_metrics": {
                    "volatility": 45.2,
                    "sharpe_ratio": 2.1,
                    "sortino_ratio": 2.8,
                    "max_drawdown": -12.3,
                    "var_95": -3.2,
                    "cvar_95": -4.5
                },
                "risk_reward_assessment": "Favorable risk/reward with Sharpe ratio above 2.0"
            }
        }


# =============================================================================
# ORCHESTRATOR AGENT SCHEMAS
# =============================================================================

class OrchestratorInput(BaseModel):
    """Input schema for Main Orchestrator Agent"""
    coin: str = Field(..., description="Cryptocurrency symbol (e.g., 'BTC', 'ETH')")
    days: int = Field(default=30, ge=7, le=365, description="Number of days for analysis")
    include_news: bool = Field(default=True, description="Include news sentiment analysis")
    include_technical: bool = Field(default=True, description="Include technical analysis")
    include_quant: bool = Field(default=True, description="Include quantitative analysis")
    
    class Config:
        json_schema_extra = {
            "example": {
                "coin": "BTC",
                "days": 30,
                "include_news": True,
                "include_technical": True,
                "include_quant": True
            }
        }


class AgentThought(BaseModel):
    """Single thought/reasoning step from an agent"""
    agent: str = Field(..., description="Agent name")
    thought: str = Field(..., description="Reasoning or action description")
    timestamp: str = Field(..., description="Timestamp of the thought")


class OrchestratorOutput(BaseModel):
    """Output schema for Main Orchestrator Agent"""
    final_analysis: str = Field(..., description="Comprehensive final analysis combining all agent insights")
    recommendation: Literal["strong_buy", "buy", "hold", "sell", "strong_sell"] = Field(..., description="Overall recommendation")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in recommendation (0-1)")
    risk_level: Literal["low", "moderate", "high", "extreme"] = Field(..., description="Overall risk assessment")
    
    # Sub-agent outputs
    news_analysis: Optional[NewsAgentOutput] = Field(None, description="News sentiment analysis results")
    technical_analysis: Optional[TechnicalAgentOutput] = Field(None, description="Technical analysis results")
    quant_analysis: Optional[QuantAgentOutput] = Field(None, description="Quantitative analysis results")
    
    # Reasoning trace
    thought_process: List[AgentThought] = Field(default=[], description="Agent reasoning trace")
    
    # Metadata
    coin: str = Field(..., description="Analyzed cryptocurrency")
    analysis_timestamp: str = Field(..., description="Analysis completion timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "final_analysis": "Based on bullish technical signals, positive market sentiment, and favorable risk metrics, BTC appears positioned for continued upward momentum...",
                "recommendation": "buy",
                "confidence": 0.75,
                "risk_level": "moderate",
                "coin": "BTC",
                "analysis_timestamp": "2024-01-15T12:00:00Z"
            }
        }


# =============================================================================
# WEBSOCKET MESSAGE SCHEMAS
# =============================================================================

class ProgressUpdate(BaseModel):
    """WebSocket progress update message"""
    type: Literal["thinking", "tool_call", "tool_result", "agent_complete", "final", "error"] = Field(..., description="Update type")
    agent: str = Field(..., description="Agent name sending the update")
    message: str = Field(..., description="Progress message")
    data: Optional[dict] = Field(None, description="Additional data payload")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="Timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "thinking",
                "agent": "Technical Agent",
                "message": "Analyzing RSI indicator...",
                "timestamp": "2024-01-15T12:00:00Z"
            }
        }
