"""
Sub-agents for multi-agent crypto analysis pipeline.
Each agent has its own tools, runs a small ReACT-style reasoning loop,
and outputs schema-validated results.
"""

import logging
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime, timezone

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool, StructuredTool
from pydantic import ValidationError

from config import GROQ_API_KEY
from ai.schemas import (
    NewsAgentInput,
    NewsAgentOutput,
    NewsEvent,
    TechnicalAgentInput,
    TechnicalAgentOutput,
    IndicatorSignal,
    KeyLevel,
    QuantAgentInput,
    QuantAgentOutput,
    ReturnMetrics,
    RiskMetrics,
    ProgressUpdate,
)
from data.tools import get_raw_news, get_raw_ta_indicators, get_raw_quant_metrics

logger = logging.getLogger("crypto-sentinel.sub_agents")


# =============================================================================
# PROGRESS CALLBACK TYPE
# =============================================================================

ProgressCallback = Callable[[ProgressUpdate], None]


def make_progress(
    type_: str,
    agent: str,
    message: str,
    data: Optional[dict] = None,
    callback: Optional[ProgressCallback] = None
):
    """Send a progress update through the callback if provided."""
    update = ProgressUpdate(
        type=type_,
        agent=agent,
        message=message,
        data=data,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
    if callback:
        callback(update)
    logger.debug(f"[{agent}] {type_}: {message}")


# =============================================================================
# LLM SETUP
# =============================================================================

def get_llm(temperature: float = 0.1):
    """Get the Groq LLM instance."""
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=GROQ_API_KEY,
        temperature=temperature,
        max_tokens=4096,
    )


# =============================================================================
# NEWS SENTIMENT AGENT
# =============================================================================

NEWS_AGENT_SYSTEM_PROMPT = """You are a News Sentiment Analysis Agent specializing in cryptocurrency markets.
Your task is to analyze recent news and provide a sentiment assessment.

Given a list of news articles with their sentiment scores, you must:
1. Identify the overall market sentiment (bullish/bearish/neutral)
2. Summarize the key themes and events
3. Highlight the most impactful news stories
4. Provide a concise natural language summary

Be objective and factual. Focus on market-moving events.
When the news is mixed, acknowledge uncertainty.
"""


def run_news_agent(
    input_data: NewsAgentInput,
    progress_callback: Optional[ProgressCallback] = None
) -> NewsAgentOutput:
    """
    Run the News Sentiment Agent.
    
    This agent:
    1. Fetches recent news with sentiment scores
    2. Uses LLM to synthesize insights
    3. Returns schema-validated output
    """
    agent_name = "News Sentiment Agent"
    
    try:
        # Step 1: Fetch raw news data
        make_progress("thinking", agent_name, f"Fetching news for {input_data.coin}...", callback=progress_callback)
        
        news_articles = get_raw_news(limit=20, force_refresh=False)
        
        if not news_articles:
            make_progress("error", agent_name, "No news articles available", callback=progress_callback)
            # Return default output
            return NewsAgentOutput(
                sentiment_summary="Unable to fetch news articles. Market sentiment unknown.",
                avg_sentiment_score=0.0,
                overall_sentiment="neutral",
                top_events=[],
                news_count=0
            )
        
        make_progress("tool_result", agent_name, f"Retrieved {len(news_articles)} news articles", callback=progress_callback)
        
        # Step 2: Calculate aggregate sentiment
        make_progress("thinking", agent_name, "Calculating aggregate sentiment...", callback=progress_callback)
        
        sentiment_scores = [a.get("sentiment_score", 0) for a in news_articles if a.get("sentiment_score") is not None]
        avg_score = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0.0
        
        # Classify overall sentiment
        if avg_score > 0.15:
            overall_sentiment = "bullish"
        elif avg_score < -0.15:
            overall_sentiment = "bearish"
        else:
            overall_sentiment = "neutral"
        
        # Step 3: Prepare top events
        # Sort by absolute sentiment score (most impactful)
        sorted_articles = sorted(
            news_articles,
            key=lambda x: abs(x.get("sentiment_score", 0)),
            reverse=True
        )[:5]
        
        top_events = []
        for article in sorted_articles:
            sentiment = article.get("sentiment", "neutral")
            top_events.append(NewsEvent(
                title=article.get("title", "Unknown"),
                sentiment=sentiment if sentiment in ["positive", "negative", "neutral"] else "neutral",
                sentiment_score=article.get("sentiment_score", 0.0),
                source=article.get("source"),
                published_at=article.get("published_at")
            ))
        
        # Step 4: Use LLM to generate summary
        make_progress("thinking", agent_name, "Generating sentiment summary with LLM...", callback=progress_callback)
        
        # Prepare news context for LLM
        news_context = "\n".join([
            f"- {a.get('title', 'N/A')} (Sentiment: {a.get('sentiment', 'neutral')}, Score: {a.get('sentiment_score', 0):.2f})"
            for a in news_articles[:15]
        ])
        
        llm = get_llm()
        
        summary_prompt = f"""Analyze the following cryptocurrency news articles and provide a concise sentiment summary for {input_data.coin}:

{news_context}

Aggregate Statistics:
- Total articles: {len(news_articles)}
- Average sentiment score: {avg_score:.3f}
- Overall sentiment: {overall_sentiment}

Provide a 2-3 sentence summary of the market sentiment, key themes, and potential market impact.
Focus on being factual and objective. Do not make price predictions."""

        response = llm.invoke([
            SystemMessage(content=NEWS_AGENT_SYSTEM_PROMPT),
            HumanMessage(content=summary_prompt)
        ])
        
        sentiment_summary = response.content.strip()
        
        make_progress("agent_complete", agent_name, "News sentiment analysis complete", callback=progress_callback)
        
        return NewsAgentOutput(
            sentiment_summary=sentiment_summary,
            avg_sentiment_score=round(avg_score, 4),
            overall_sentiment=overall_sentiment,
            top_events=top_events,
            news_count=len(news_articles)
        )
        
    except Exception as e:
        logger.exception("News agent error")
        make_progress("error", agent_name, f"Error: {str(e)}", callback=progress_callback)
        
        # Return safe default
        return NewsAgentOutput(
            sentiment_summary=f"Error analyzing news: {str(e)}",
            avg_sentiment_score=0.0,
            overall_sentiment="neutral",
            top_events=[],
            news_count=0
        )


# =============================================================================
# TECHNICAL ANALYSIS AGENT
# =============================================================================

TECHNICAL_AGENT_SYSTEM_PROMPT = """You are a Technical Analysis Agent specializing in cryptocurrency markets.
Your task is to analyze price data and technical indicators to identify trends and signals.

Given OHLCV data and computed indicators (RSI, MACD, EMAs, Bollinger Bands, etc.), you must:
1. Identify the current trend (bullish/bearish/neutral/mixed)
2. Interpret each indicator's signal
3. Identify key support and resistance levels
4. Provide a concise natural language summary

Be objective and technical. Use proper TA terminology.
When signals conflict, acknowledge the mixed picture.
"""


def run_technical_agent(
    input_data: TechnicalAgentInput,
    progress_callback: Optional[ProgressCallback] = None
) -> TechnicalAgentOutput:
    """
    Run the Technical Analysis Agent.
    
    This agent:
    1. Fetches OHLCV data and computes indicators
    2. Uses LLM to interpret signals
    3. Returns schema-validated output
    """
    agent_name = "Technical Analysis Agent"
    
    try:
        # Step 1: Fetch technical indicators
        make_progress("thinking", agent_name, f"Fetching technical data for {input_data.coin}...", callback=progress_callback)
        
        ta_data = get_raw_ta_indicators(symbol=input_data.coin, days=input_data.days)
        
        if ta_data.get("error"):
            make_progress("error", agent_name, f"Error: {ta_data['error']}", callback=progress_callback)
            return TechnicalAgentOutput(
                trend_summary=f"Unable to fetch technical data: {ta_data['error']}",
                overall_trend="neutral",
                key_levels=[],
                indicator_signals=[],
                current_price=0.0,
                price_change_pct=0.0
            )
        
        ohlcv = ta_data.get("ohlcv", {})
        indicators = ta_data.get("indicators", {})
        
        make_progress("tool_result", agent_name, f"Retrieved {len(ohlcv.get('close', []))} data points", callback=progress_callback)
        
        # Step 2: Extract current values
        make_progress("thinking", agent_name, "Analyzing indicator signals...", callback=progress_callback)
        
        close_prices = ohlcv.get("close", [])
        if not close_prices:
            raise ValueError("No price data available")
        
        current_price = close_prices[-1]
        first_price = close_prices[0] if close_prices else current_price
        price_change_pct = ((current_price - first_price) / first_price * 100) if first_price else 0
        
        # Step 3: Interpret indicators
        indicator_signals = []
        
        # RSI
        rsi_values = indicators.get("rsi", [])
        if rsi_values:
            rsi_current = rsi_values[-1]
            if rsi_current is not None:
                if rsi_current > 70:
                    rsi_signal = "bearish"
                    rsi_desc = f"RSI at {rsi_current:.1f} indicates overbought conditions"
                elif rsi_current < 30:
                    rsi_signal = "bullish"
                    rsi_desc = f"RSI at {rsi_current:.1f} indicates oversold conditions"
                else:
                    rsi_signal = "neutral"
                    rsi_desc = f"RSI at {rsi_current:.1f} is in neutral territory"
                
                indicator_signals.append(IndicatorSignal(
                    indicator="RSI",
                    value=round(rsi_current, 2),
                    signal=rsi_signal,
                    description=rsi_desc
                ))
        
        # MACD
        macd_data = indicators.get("macd", {})
        macd_line = macd_data.get("macd", [])
        signal_line = macd_data.get("signal", [])
        macd_hist = macd_data.get("hist", [])
        
        if macd_line and signal_line:
            macd_current = macd_line[-1] if macd_line[-1] is not None else 0
            signal_current = signal_line[-1] if signal_line[-1] is not None else 0
            hist_current = macd_hist[-1] if macd_hist and macd_hist[-1] is not None else 0
            
            if macd_current > signal_current:
                macd_signal = "bullish"
                macd_desc = "MACD line above signal line, bullish momentum"
            else:
                macd_signal = "bearish"
                macd_desc = "MACD line below signal line, bearish momentum"
            
            indicator_signals.append(IndicatorSignal(
                indicator="MACD",
                value=round(hist_current, 4),
                signal=macd_signal,
                description=macd_desc
            ))
        
        # EMAs
        ema_data = indicators.get("ema", {})
        ema_20 = ema_data.get("20", [])
        ema_50 = ema_data.get("50", [])
        
        if ema_20 and ema_50:
            ema20_current = ema_20[-1] if ema_20[-1] is not None else 0
            ema50_current = ema_50[-1] if ema_50[-1] is not None else 0
            
            if ema20_current > ema50_current:
                ema_signal = "bullish"
                ema_desc = "Short-term EMA above long-term EMA, uptrend"
            else:
                ema_signal = "bearish"
                ema_desc = "Short-term EMA below long-term EMA, downtrend"
            
            indicator_signals.append(IndicatorSignal(
                indicator="EMA Cross",
                value=round(ema20_current - ema50_current, 2),
                signal=ema_signal,
                description=ema_desc
            ))
        
        # Bollinger Bands
        bbands = indicators.get("bbands", {})
        bb_upper = bbands.get("upper", [])
        bb_lower = bbands.get("lower", [])
        
        if bb_upper and bb_lower and close_prices:
            upper_current = bb_upper[-1] if bb_upper[-1] is not None else current_price
            lower_current = bb_lower[-1] if bb_lower[-1] is not None else current_price
            
            if current_price > upper_current:
                bb_signal = "bearish"
                bb_desc = "Price above upper Bollinger Band, potential reversal"
            elif current_price < lower_current:
                bb_signal = "bullish"
                bb_desc = "Price below lower Bollinger Band, potential bounce"
            else:
                bb_signal = "neutral"
                bb_desc = "Price within Bollinger Bands"
            
            indicator_signals.append(IndicatorSignal(
                indicator="Bollinger Bands",
                value=round(current_price, 2),
                signal=bb_signal,
                description=bb_desc
            ))
        
        # Step 4: Identify key levels
        make_progress("thinking", agent_name, "Identifying support/resistance levels...", callback=progress_callback)
        
        key_levels = []
        high_prices = ohlcv.get("high", [])
        low_prices = ohlcv.get("low", [])
        
        if high_prices and low_prices:
            recent_high = max([h for h in high_prices[-20:] if h is not None], default=current_price)
            recent_low = min([l for l in low_prices[-20:] if l is not None], default=current_price)
            
            key_levels.append(KeyLevel(
                level_type="resistance",
                price=round(recent_high, 2),
                strength="moderate"
            ))
            key_levels.append(KeyLevel(
                level_type="support",
                price=round(recent_low, 2),
                strength="moderate"
            ))
        
        # Step 5: Determine overall trend
        bullish_count = sum(1 for s in indicator_signals if s.signal == "bullish")
        bearish_count = sum(1 for s in indicator_signals if s.signal == "bearish")
        
        if bullish_count > bearish_count + 1:
            overall_trend = "bullish"
        elif bearish_count > bullish_count + 1:
            overall_trend = "bearish"
        elif bullish_count == 0 and bearish_count == 0:
            overall_trend = "neutral"
        else:
            overall_trend = "mixed"
        
        # Step 6: Use LLM to generate summary
        make_progress("thinking", agent_name, "Generating technical summary with LLM...", callback=progress_callback)
        
        signals_text = "\n".join([
            f"- {s.indicator}: {s.signal.upper()} ({s.description})"
            for s in indicator_signals
        ])
        
        llm = get_llm()
        
        # Format key levels with proper conditional handling
        resistance_str = f"${key_levels[0].price:,.2f}" if key_levels else "N/A"
        support_str = f"${key_levels[1].price:,.2f}" if len(key_levels) > 1 else "N/A"
        
        summary_prompt = f"""Analyze the following technical indicators for {input_data.coin}:

Current Price: ${current_price:,.2f}
Price Change ({input_data.days}d): {price_change_pct:+.2f}%

Indicator Signals:
{signals_text}

Key Levels:
- Resistance: {resistance_str}
- Support: {support_str}

Overall Trend: {overall_trend.upper()}

Provide a 2-3 sentence technical analysis summary. Focus on actionable insights.
Be objective and use proper technical analysis terminology."""

        response = llm.invoke([
            SystemMessage(content=TECHNICAL_AGENT_SYSTEM_PROMPT),
            HumanMessage(content=summary_prompt)
        ])
        
        trend_summary = response.content.strip()
        
        make_progress("agent_complete", agent_name, "Technical analysis complete", callback=progress_callback)
        
        return TechnicalAgentOutput(
            trend_summary=trend_summary,
            overall_trend=overall_trend,
            key_levels=key_levels,
            indicator_signals=indicator_signals,
            current_price=round(current_price, 2),
            price_change_pct=round(price_change_pct, 2)
        )
        
    except Exception as e:
        logger.exception("Technical agent error")
        make_progress("error", agent_name, f"Error: {str(e)}", callback=progress_callback)
        
        return TechnicalAgentOutput(
            trend_summary=f"Error analyzing technical data: {str(e)}",
            overall_trend="neutral",
            key_levels=[],
            indicator_signals=[],
            current_price=0.0,
            price_change_pct=0.0
        )


# =============================================================================
# QUANTITATIVE METRICS AGENT
# =============================================================================

QUANT_AGENT_SYSTEM_PROMPT = """You are a Quantitative Metrics Agent specializing in cryptocurrency risk analysis.
Your task is to analyze risk and return metrics to assess the risk profile.

Given return statistics and risk metrics (Sharpe, Sortino, VaR, etc.), you must:
1. Assess the overall risk level (low/moderate/high/extreme)
2. Evaluate the risk-adjusted returns
3. Identify key risk factors
4. Provide a concise natural language summary

Be objective and quantitative. Use proper financial terminology.
Focus on risk management implications.
"""


def run_quant_agent(
    input_data: QuantAgentInput,
    progress_callback: Optional[ProgressCallback] = None
) -> QuantAgentOutput:
    """
    Run the Quantitative Metrics Agent.
    
    This agent:
    1. Fetches quant metrics (Sharpe, VaR, etc.)
    2. Uses LLM to interpret risk profile
    3. Returns schema-validated output
    """
    agent_name = "Quantitative Metrics Agent"
    
    try:
        # Step 1: Fetch quant metrics
        make_progress("thinking", agent_name, f"Fetching quantitative metrics for {input_data.coin}...", callback=progress_callback)
        
        quant_data = get_raw_quant_metrics(symbol=input_data.coin, days=input_data.days)
        
        if quant_data.get("error"):
            make_progress("error", agent_name, f"Error: {quant_data['error']}", callback=progress_callback)
            return QuantAgentOutput(
                risk_summary=f"Unable to fetch quant metrics: {quant_data['error']}",
                risk_level="moderate",
                return_metrics=ReturnMetrics(
                    total_return=0, annualized_return=0, daily_avg_return=0, best_day=0, worst_day=0
                ),
                risk_metrics=RiskMetrics(
                    volatility=0, sharpe_ratio=0, sortino_ratio=0, max_drawdown=0, var_95=0, cvar_95=0
                ),
                risk_reward_assessment="Unable to assess risk/reward"
            )
        
        metrics = quant_data.get("metrics", {})
        returns_data = metrics.get("returns", {})
        risk_data = metrics.get("risk", {})
        perf_data = metrics.get("performance", {})
        
        make_progress("tool_result", agent_name, "Retrieved quantitative metrics", callback=progress_callback)
        
        # Step 2: Build return metrics
        make_progress("thinking", agent_name, "Analyzing return metrics...", callback=progress_callback)
        
        return_metrics = ReturnMetrics(
            total_return=round(perf_data.get("total_return", 0) * 100, 2),
            annualized_return=round(returns_data.get("annualized_return", 0) * 100, 2),
            daily_avg_return=round(returns_data.get("daily_mean", 0) * 100, 4),
            best_day=round(perf_data.get("best_day", 0) * 100, 2),
            worst_day=round(perf_data.get("worst_day", 0) * 100, 2)
        )
        
        # Step 3: Build risk metrics
        make_progress("thinking", agent_name, "Analyzing risk metrics...", callback=progress_callback)
        
        risk_metrics = RiskMetrics(
            volatility=round(returns_data.get("annualized_volatility", 0) * 100, 2),
            sharpe_ratio=round(risk_data.get("sharpe_ratio", 0), 2),
            sortino_ratio=round(risk_data.get("sortino_ratio", 0), 2),
            max_drawdown=round(risk_data.get("max_drawdown", 0) * 100, 2),
            var_95=round(risk_data.get("var_95", 0) * 100, 2),
            cvar_95=round(risk_data.get("cvar_95", 0) * 100, 2)
        )
        
        # Step 4: Determine risk level
        volatility = returns_data.get("annualized_volatility", 0)
        max_dd = abs(risk_data.get("max_drawdown", 0))
        
        if volatility > 1.0 or max_dd > 0.5:
            risk_level = "extreme"
        elif volatility > 0.6 or max_dd > 0.3:
            risk_level = "high"
        elif volatility > 0.3 or max_dd > 0.15:
            risk_level = "moderate"
        else:
            risk_level = "low"
        
        # Step 5: Use LLM to generate summary
        make_progress("thinking", agent_name, "Generating risk summary with LLM...", callback=progress_callback)
        
        llm = get_llm()
        
        summary_prompt = f"""Analyze the following quantitative metrics for {input_data.coin}:

Return Metrics:
- Total Return ({input_data.days}d): {return_metrics.total_return:+.2f}%
- Annualized Return: {return_metrics.annualized_return:+.2f}%
- Best Day: {return_metrics.best_day:+.2f}%
- Worst Day: {return_metrics.worst_day:+.2f}%

Risk Metrics:
- Annualized Volatility: {risk_metrics.volatility:.2f}%
- Sharpe Ratio: {risk_metrics.sharpe_ratio:.2f}
- Sortino Ratio: {risk_metrics.sortino_ratio:.2f}
- Max Drawdown: {risk_metrics.max_drawdown:.2f}%
- VaR (95%): {risk_metrics.var_95:.2f}%
- CVaR (95%): {risk_metrics.cvar_95:.2f}%

Risk Level: {risk_level.upper()}

Provide:
1. A 2-3 sentence risk summary
2. A brief risk/reward assessment

Focus on risk management implications. Be objective and quantitative."""

        response = llm.invoke([
            SystemMessage(content=QUANT_AGENT_SYSTEM_PROMPT),
            HumanMessage(content=summary_prompt)
        ])
        
        # Parse response for summary and assessment
        full_response = response.content.strip()
        
        # Simple split - first paragraph is summary, rest is assessment
        parts = full_response.split("\n\n")
        risk_summary = parts[0].strip() if parts else full_response
        risk_reward_assessment = parts[1].strip() if len(parts) > 1 else "See risk summary above."
        
        make_progress("agent_complete", agent_name, "Quantitative analysis complete", callback=progress_callback)
        
        return QuantAgentOutput(
            risk_summary=risk_summary,
            risk_level=risk_level,
            return_metrics=return_metrics,
            risk_metrics=risk_metrics,
            risk_reward_assessment=risk_reward_assessment
        )
        
    except Exception as e:
        logger.exception("Quant agent error")
        make_progress("error", agent_name, f"Error: {str(e)}", callback=progress_callback)
        
        return QuantAgentOutput(
            risk_summary=f"Error analyzing quant metrics: {str(e)}",
            risk_level="moderate",
            return_metrics=ReturnMetrics(
                total_return=0, annualized_return=0, daily_avg_return=0, best_day=0, worst_day=0
            ),
            risk_metrics=RiskMetrics(
                volatility=0, sharpe_ratio=0, sortino_ratio=0, max_drawdown=0, var_95=0, cvar_95=0
            ),
            risk_reward_assessment="Unable to assess risk/reward due to error"
        )
